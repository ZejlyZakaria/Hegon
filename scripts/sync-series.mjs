// SYNC A SERIES WITH THE WORLD — and repair the rows the old model made impossible to get right.
//
//   node scripts/sync-series.mjs              → DRY RUN. Shows every change, writes nothing.
//   node scripts/sync-series.mjs --apply      → actually writes.
//   node scripts/sync-series.mjs --apply --only=ongoing   → skip shows already known to be over
//
// WHY THIS EXISTS
// `status` and `season_episodes` were snapshots taken the day a title was added, and NOTHING
// ever refreshed them. So The Boys stays "ongoing" for eternity, and Bleach exists twice in the
// database with 53 and 41 episodes. A model can't tell the truth about "have you seen
// everything?" if it never asks the world what exists.
//
// WHAT IT DOES, per series:
//   1. Refetch TMDB: real status, real seasons, and — the point — how many episodes of each
//      season have ACTUALLY AIRED (air_date <= today). That's `season_aired`.
//      TMDB lists ANNOUNCED seasons: HotD says 8 episodes in S3, three of which exist.
//   2. Recompute your state from two numbers (seen vs aired), and fix it if it lies:
//      · `watched` on a show that isn't over  → in_progress + caught_up (the 25 bad rows)
//      · `watched` on a show that came BACK   → in_progress (Dexter — revivals are real)
//   3. Never invent a position. A row marked watched with no episode position gets placed at
//      the last aired episode, because that is what "I've seen it all" meant when you clicked.
//
// Idempotent. Re-running it changes nothing that's already true.

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadEnv(path) {
  try {
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch { /* optional */ }
}
loadEnv(".env.local");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TMDB_KEY = process.env.TMDB_API_KEY;
if (!SUPABASE_URL || !SERVICE_KEY || !TMDB_KEY) {
  console.error("Missing env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TMDB_API_KEY");
  process.exit(1);
}

const APPLY = process.argv.includes("--apply");
const ONLY_ONGOING = process.argv.includes("--only=ongoing");
const db = createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: "watching" } });

const TODAY = new Date().toISOString().slice(0, 10);
const FINISHED = new Set(["ended", "canceled", "cancelled"]);
const isFinished = (s) => FINISHED.has(String(s ?? "").toLowerCase());

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function tmdb(path, params = {}) {
  const url = new URL(`https://api.themoviedb.org/3/${path}`);
  url.searchParams.set("api_key", TMDB_KEY);
  url.searchParams.set("language", "en-US");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url);
    if (res.status === 429) { await sleep(1000 * (attempt + 1)); continue; }
    if (!res.ok) throw new Error(`TMDB ${res.status} on ${path}`);
    return res.json();
  }
  throw new Error(`TMDB rate-limited on ${path}`);
}

/**
 * How many episodes of each season have ACTUALLY AIRED.
 * TMDB's season list includes announced seasons with their full episode counts, so the only
 * honest way is to ask each season for its episodes and count the ones whose air_date has
 * passed. An episode with NO air date has not aired — an unknown date is not a past date.
 */
async function airedPerSeason(tmdbId, seasons) {
  const out = [];
  for (const s of seasons) {
    // Only a season whose start is in the FUTURE can be skipped without asking. A MISSING season
    // air_date is not a future one — TMDB simply doesn't always carry it (One Piece has none on
    // most of its 23 seasons), and treating that as "unaired" reported [61,0,0,0…] for a show
    // with a thousand episodes behind it. An unknown date is not an answer; go and count.
    if (s.air_date && s.air_date > TODAY) {
      out.push({ aired: 0, endDate: null });
      continue;
    }
    const detail = await tmdb(`tv/${tmdbId}/season/${s.season_number}`);
    // Per EPISODE: aired = it has a date, and the date has passed. Here too, no date = not out.
    const airedEps = (detail.episodes ?? []).filter((e) => e.air_date && e.air_date <= TODAY);
    out.push({
      aired: airedEps.length,
      // The date the season ENDED — the earliest you could have finished it. Null while a season
      // is still coming out: there is no honest answer yet, and a missing date must never be
      // dressed up as a known one.
      endDate:
        airedEps.length > 0 && airedEps.length === (s.episode_count ?? 0)
          ? airedEps[airedEps.length - 1].air_date
          : null,
    });
    await sleep(60);   // TMDB is generous but not infinite
  }
  return out;
}

const total = (a) => (a ?? []).reduce((x, y) => x + (y || 0), 0);
const lastAired = (aired) => {
  for (let s = aired.length; s >= 1; s--) if ((aired[s - 1] ?? 0) > 0) return { season: s, episode: aired[s - 1] };
  return null;
};

// ── Run ───────────────────────────────────────────────────────────────────────

let query = db.from("media_items")
  // `recently_watched` was dropped (Last Watched derives from watched_at) — selecting it kills the run.
  .select("id,title,type,tmdb_id,status,watched,in_progress,paused,dropped,current_season,current_episode,season_episodes,season_aired,season_end_dates,caught_up_at,watched_at,is_reference")
  .neq("type", "film")
  .eq("is_reference", false)
  .not("tmdb_id", "is", null);
if (ONLY_ONGOING) query = query.not("status", "in", "(ended,canceled,cancelled)");

const { data: items, error } = await query;
if (error) { console.error(error.message); process.exit(1); }

console.log(`${APPLY ? "APPLY" : "DRY RUN"} — ${items.length} series/animes\n`);

let changed = 0, repaired = 0, failed = 0;

for (const m of items) {
  let show;
  try {
    show = await tmdb(`tv/${m.tmdb_id}`);
  } catch (e) {
    console.log(`  ✗ ${m.title}: ${e.message}`);
    failed++;
    continue;
  }

  const seasons = (show.seasons ?? []).filter((s) => s.season_number > 0);   // drop "Specials"
  const rawStatus = String(show.status ?? "").toLowerCase();
  const status = isFinished(rawStatus) ? (rawStatus === "ended" ? "ended" : "canceled") : "ongoing";
  const season_episodes = seasons.map((s) => s.episode_count ?? 0);
  const facts = await airedPerSeason(m.tmdb_id, seasons);
  const season_aired = facts.map((f) => f.aired);
  const season_end_dates = facts.map((f) => f.endDate);

  const next = {
    status,
    seasons: seasons.length,
    episodes: total(season_episodes),
    season_episodes,
    season_aired,
    season_end_dates,
    last_synced_at: new Date().toISOString(),
  };

  const airedTotal = total(season_aired);
  const notes = [];

  // ── The repairs ────────────────────────────────────────────────────────────
  const pos = lastAired(season_aired);

  // Most `watched` series were marked watched WITHOUT ever tracking a position (current_episode
  // is null: you clicked "watched", you never used a stepper). That's not "0 episodes seen" —
  // it's "I saw all of it, and I never told you where I was". Give them the position their click
  // always meant, so the derived state can work at all. This is a no-op for anyone who tracked.
  const positionless = m.watched && m.current_episode == null && pos;
  if (positionless) {
    next.current_season = pos.season;
    next.current_episode = pos.episode;
  }

  // A row marked `watched` on a show that is NOT over. It was never a user error: "watched" was
  // the only word the app knew. It means "I'm caught up" — so say that instead.
  if (m.watched && !isFinished(status) && airedTotal > 0) {
    Object.assign(next, {
      watched: false,
      in_progress: true,
      paused: false,
      dropped: false,
      current_season: m.current_season ?? pos.season,
      current_episode: m.current_episode ?? pos.episode,
      // You've been caught up since the day you said you'd finished it.
      caught_up_at: m.caught_up_at ?? m.watched_at ?? new Date().toISOString(),
    });
    notes.push(`REPAIR watched→caught-up (S${next.current_season}E${next.current_episode})`);
    repaired++;
  }
  // A finished show that GREW — a revival, a late special season (Dexter is the archetype).
  //
  // ⚠️ This can ONLY be detected against a previous `season_aired` snapshot. On the FIRST sync
  // there is no baseline, and the naive test ("aired > seen") destroys everything: a watched
  // show with no tracked position reports 0 seen, so Breaking Bad, Lost, Suits and Demon Slayer
  // all looked like they had "grown" and were about to be marked unwatched. The dry run caught
  // it. No baseline → no claim. Growth is a comparison, not a guess.
  else if (m.watched && isFinished(status) && m.season_aired != null && airedTotal > total(m.season_aired)) {
    Object.assign(next, {
      watched: false,
      in_progress: true,
      // You stopped where the show used to end.
      current_season: m.current_season ?? 1,
      current_episode: m.current_episode ?? 0,
      caught_up_at: m.caught_up_at ?? m.watched_at ?? new Date().toISOString(),
    });
    notes.push(`REPAIR finished show grew (${total(m.season_aired)}→${airedTotal} aired) → in progress`);
    repaired++;
  }

  // ── What actually differs ──────────────────────────────────────────────────
  const diffs = [];
  if (m.status !== next.status) diffs.push(`status ${m.status}→${next.status}`);
  if (positionless) diffs.push(`position null→S${next.current_season}E${next.current_episode}`);
  if (JSON.stringify(m.season_aired) !== JSON.stringify(season_aired)) diffs.push(`aired ${JSON.stringify(m.season_aired ?? null)}→${JSON.stringify(season_aired)}`);
  if (JSON.stringify(m.season_episodes) !== JSON.stringify(season_episodes)) diffs.push(`announced ${JSON.stringify(m.season_episodes)}→${JSON.stringify(season_episodes)}`);
  // EVERY column this script writes must be in this list, or the row is skipped before the write
  // and the column never lands. `season_end_dates` was computed, was in `next`, and would have
  // stayed empty on all 239 rows — because nothing else about them had changed.
  if (JSON.stringify(m.season_end_dates ?? []) !== JSON.stringify(season_end_dates)) diffs.push(`end dates → ${JSON.stringify(season_end_dates)}`);

  if (diffs.length === 0 && notes.length === 0) continue;

  changed++;
  console.log(`  ${m.title}`);
  for (const n of notes) console.log(`      ⚠ ${n}`);
  for (const d of diffs) console.log(`      · ${d}`);

  if (APPLY) {
    const { error: upErr } = await db.from("media_items").update(next).eq("id", m.id);
    if (upErr) { console.log(`      ✗ write failed: ${upErr.message}`); failed++; }
  }
}

console.log(
  `\n${changed} changed · ${repaired} repaired (watched on an unfinished show) · ${failed} failed` +
  (APPLY ? "" : "\n\nNothing was written. Re-run with --apply.")
);
