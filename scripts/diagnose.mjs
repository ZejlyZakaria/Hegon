// DOES THE DATABASE MAKE SENSE?  READ ONLY — this lists and explains, it never writes.
//
//   node scripts/diagnose.mjs                 → every finding, grouped by severity
//   node scripts/diagnose.mjs --impossible    → only the "this cannot be true" tier
//
// WHY
// Three real bugs surfaced in two days — Elite worth zero hours, JJK's three years collapsed onto
// one, runtimes that were double-length finales — and every one shared a shape: an impossible value
// that nothing flagged, found only by the owner feeling that a number looked wrong. This turns that
// feeling into a list. A total has no accountability; a checked invariant does.
//
// It reasons with the app's OWN pure libs (series-state, watch-status) wherever it can, so a finding
// here means the same thing a finding in the app would — not a second, drifting opinion.
//
// The tiers:
//   IMPOSSIBLE — a physical contradiction. Watched before it existed; seen more than has aired.
//   SUSPECT    — probably wrong, not provably. A missing runtime; an aberrant one; a stalled sync.
//   NOTE       — worth an eye, not an alarm.

import { readFileSync } from "node:fs";
import { seriesState, airedCount } from "../src/modules/watching/lib/series-state.ts";

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
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const IMPOSSIBLE_ONLY = process.argv.includes("--impossible");

const rest = (path) =>
  fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Accept-Profile": "watching" },
  });

const COLS = [
  "id", "tmdb_id", "type", "title", "status", "year", "release_date",
  "runtime", "episodes", "season_episodes", "season_aired", "season_air_dates",
  "current_season", "current_episode", "caught_up_at",
  "watched", "in_progress", "paused", "dropped", "want_to_watch", "is_reference",
  "watched_at", "created_at", "season_years", "cour_years",
].join(",");

const mediaRes = await rest(`media_items?select=${COLS}&is_reference=not.eq.true&limit=3000`);
if (!mediaRes.ok) { console.error("READ FAILED", mediaRes.status, await mediaRes.text()); process.exit(1); }
const rows = await mediaRes.json();

const rwRes = await rest("rewatches?select=media_item_id,watched_on&limit=5000");
const rewatches = rwRes.ok ? await rwRes.json() : [];

// The AniList cours — the SAME source the stats page reads — so a `cour_years` stamp can be checked
// against the year that cour actually finished airing, not the franchise's start. tmdb_id → cours.
const coursRes = await rest("anime_cours?select=tmdb_id,cours,source&source=eq.anilist&limit=2000");
const coursByTmdb = new Map((coursRes.ok ? await coursRes.json() : []).map((c) => [c.tmdb_id, c.cours ?? []]));

// ── findings ──────────────────────────────────────────────────────────────────
const findings = { IMPOSSIBLE: [], SUSPECT: [], NOTE: [] };
const add = (tier, rule, title, detail) => findings[tier].push({ rule, title, detail });

const yearOf = (d) => (d ? new Date(d).getFullYear() : null);
const NOW = new Date();
const THIS_YEAR = NOW.getFullYear();
const billsHours = (r) => r.watched || r.in_progress || r.paused || r.dropped;

for (const r of rows) {
  const isFilm = r.type === "film";
  const seenAt = yearOf(r.watched_at);

  // ── IMPOSSIBLE ────────────────────────────────────────────────────────────

  // Watched a film before it was released.
  if (isFilm && r.watched && r.watched_at && r.release_date && r.watched_at < r.release_date) {
    add("IMPOSSIBLE", "watched-before-release", r.title,
      `watched ${r.watched_at.slice(0, 10)} · released ${r.release_date.slice(0, 10)}`);
  }

  // Any watch date in the future.
  if (r.watched_at && new Date(r.watched_at) > NOW) {
    add("IMPOSSIBLE", "watched-in-future", r.title, `watched_at = ${r.watched_at.slice(0, 10)}`);
  }

  // A series/anime: seen more episodes than have aired. `watchedCount` clamps on read, so this is
  // testing the STORED position against the STORED aired counts directly.
  if (!isFilm && Array.isArray(r.season_aired)) {
    const aired = r.season_aired.reduce((a, b) => a + (b || 0), 0);
    const cs = r.current_season ?? 1;
    const ce = r.current_episode ?? 0;
    if (ce > (r.season_aired[cs - 1] ?? 0) && aired > 0) {
      add("IMPOSSIBLE", "position-beyond-aired", r.title,
        `at S${cs}E${ce}, but only ${r.season_aired[cs - 1] ?? 0} aired in S${cs} (${JSON.stringify(r.season_aired)})`);
    }
    // Marked fully watched, but the model says it can't be — the 25-rows disease, checked with the
    // app's own state machine.
    if (r.watched) {
      const state = seriesState({
        season_aired: r.season_aired, season_episodes: r.season_episodes, status: r.status,
        current_season: cs, current_episode: ce, caught_up_at: r.caught_up_at,
      });
      if (state && state !== "completed") {
        add("IMPOSSIBLE", "watched-but-not-finished", r.title,
          `flagged watched, but state = ${state} (status ${r.status ?? "?"})`);
      }
    }
  }

  // A season/cour stamped IMPOSSIBLY — in the future, or before it finished airing. The floor is
  // the LAST aired episode's date (`season_end_dates`), not the first (`season_air_dates`): a season
  // that ran Oct 2023 → Feb 2024 could not have been watched THROUGH in 2023, and checking the start
  // date would have let that pass. `season_years` maps to TMDB seasons precisely; `cour_years` has
  // no per-cour dates here (they live in anime_cours), so it gets the coarse but safe floor of the
  // show's own first-air year — enough to catch a cour stamped before the show existed.
  const checkStamp = (kind, s, y, floorYear) => {
    if (y > THIS_YEAR) add("IMPOSSIBLE", "watch-year-in-future", r.title, `${kind} ${s} stamped ${y}`);
    else if (floorYear && y < floorYear) add("IMPOSSIBLE", "season-year-before-air", r.title, `${kind} ${s} stamped ${y}, aired through ${floorYear}`);
  };
  for (const [s, y] of Object.entries(r.season_years ?? {})) {
    const end = r.season_end_dates?.[Number(s) - 1] ?? r.season_air_dates?.[Number(s) - 1];
    checkStamp("Season", s, y, yearOf(end));
  }
  // `cour_years` is checked against the CORRESPONDING cour's own finish year (`end_year ?? year`,
  // the same floor the overlay synthesises), loaded from anime_cours — precise, not the franchise
  // coarse floor. Only if a cour is entirely undated do we fall back to the show's first-air year.
  const cours = coursByTmdb.get(r.tmdb_id) ?? [];
  const showFloor = yearOf(r.season_air_dates?.[0]) ?? r.year ?? null;
  for (const [s, y] of Object.entries(r.cour_years ?? {})) {
    const cour = cours.find((c) => c.season === Number(s));
    checkStamp("Cour", s, y, cour ? (cour.end_year ?? cour.year ?? showFloor) : showFloor);
  }

  // ── SUSPECT ───────────────────────────────────────────────────────────────

  if (billsHours(r) && !(r.runtime > 0)) {
    add("SUSPECT", "no-runtime", r.title, `${r.type} counts hours but runtime is ${r.runtime}`);
  }

  // A per-episode runtime far outside the plausible band for its kind. The anime ceiling is 50, not
  // 30, because OVA-style series are legitimately ~45 min (Hellsing Ultimate) — the tighter band
  // cried wolf on them. A stored value ABOVE the ceiling most often means the finale's length
  // leaked in (The Wire: 94 stored, 59 real), which is exactly what the runtime repair fixes.
  if (!isFilm && r.runtime > 0) {
    const band = r.type === "anime" ? [15, 50] : [18, 90];
    if (r.runtime < band[0] || r.runtime > band[1]) {
      add("SUSPECT", "aberrant-runtime", r.title, `${r.runtime} min/ep (expected ${band[0]}–${band[1]} for ${r.type})`);
    }
  }

  // Owned for a while, existed for years, and the sync has still never filled airing data.
  if (!isFilm && billsHours(r) && !airedCount({ season_aired: r.season_aired })) {
    const old = r.created_at && (NOW - new Date(r.created_at)) > 30 * 864e5;
    if (old) add("SUSPECT", "no-aired-data", r.title, `no season_aired; added ${r.created_at?.slice(0, 10)}`);
  }

  // Marked watched with no date at all — it counts everywhere but can never land on a year.
  if (r.watched && !r.watched_at && isFilm) {
    add("SUSPECT", "watched-no-date", r.title, "watched film with no watched_at");
  }

  // ── NOTE ──────────────────────────────────────────────────────────────────

  if (seenAt && seenAt > THIS_YEAR) {
    add("NOTE", "watch-year-ahead", r.title, `watched_at year ${seenAt}`);
  }
}

// Rewatches dated before the title was first watched.
const byId = new Map(rows.map((r) => [r.id, r]));
for (const rw of rewatches) {
  const it = byId.get(rw.media_item_id);
  if (!it) continue;
  if (it.watched_at && rw.watched_on < it.watched_at.slice(0, 10)) {
    add("IMPOSSIBLE", "rewatch-before-first", it.title,
      `rewatched ${rw.watched_on}, but first watched ${it.watched_at.slice(0, 10)}`);
  }
  if (new Date(rw.watched_on) > NOW) {
    add("IMPOSSIBLE", "rewatch-in-future", it.title, `rewatched ${rw.watched_on}`);
  }
}

// ── report ──────────────────────────────────────────────────────────────────
const ICON = { IMPOSSIBLE: "⛔", SUSPECT: "⚠️ ", NOTE: "·" };
const tiers = IMPOSSIBLE_ONLY ? ["IMPOSSIBLE"] : ["IMPOSSIBLE", "SUSPECT", "NOTE"];

console.log(`\nScanned ${rows.length} titles + ${rewatches.length} rewatches.\n`);
let total = 0;
for (const tier of tiers) {
  const list = findings[tier];
  total += list.length;
  console.log(`── ${tier} (${list.length}) ${"─".repeat(Math.max(0, 44 - tier.length))}`);
  if (list.length === 0) { console.log("   nothing\n"); continue; }

  // Group by rule so a repeated problem reads as one thing.
  const byRule = {};
  for (const f of list) (byRule[f.rule] ??= []).push(f);
  for (const [rule, fs] of Object.entries(byRule).sort((a, b) => b[1].length - a[1].length)) {
    console.log(`\n  ${ICON[tier]} ${rule}  (${fs.length})`);
    for (const f of fs.slice(0, 20)) console.log(`     ${f.title.slice(0, 40).padEnd(42)} ${f.detail}`);
    if (fs.length > 20) console.log(`     …and ${fs.length - 20} more`);
  }
  console.log("");
}
console.log(`${total} finding${total === 1 ? "" : "s"}. Nothing was written.`);
