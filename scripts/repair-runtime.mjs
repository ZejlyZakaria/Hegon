// REPAIR THE RUNTIMES.
//
//   node --experimental-strip-types scripts/repair-runtime.mjs           → DRY RUN, writes nothing
//   node --experimental-strip-types scripts/repair-runtime.mjs --apply   → actually writes
//   …--missing-only     → only fill rows that have no runtime at all (the original behaviour)
//
// TWO JOBS, because the cascade changed twice in two days:
//   1. FILL what is missing. A row born with `runtime = null` is worth zero hours forever.
//   2. RECOMPUTE what is wrong. Shows were briefly given `last_episode_to_air.runtime` — ONE
//      sample, taken at the worst moment, because the newest episode is very often a double-length
//      finale. Demon Slayer got 41 where its episodes run 24; Elite got 57 where they run 47, which
//      over 64 episodes is ten invented hours. The cascade now takes the MEDIAN of a real season.
//      Films are left alone unless empty: `movie.runtime` was never in doubt.
//
// WHY THIS EXISTS
// `runtime` is written once, when a title is added, and NOTHING ever repairs it — not the hourly
// series sync (it only touches status/season_*), not any other script. So a row born with
// `runtime = null` is worth 0 hours in Stats forever, silently, because a null propagates to 0 and
// 0 still looks like a number.
//
// Rows were born that way because the mapper behind the discover page stopped one rung short of the
// add modal's cascade: TMDB returns `episode_run_time: []` for essentially every modern series, and
// only the modal knew to fall back on `last_episode_to_air.runtime`. Elite: 0.0 h through discover,
// 60.8 h through the modal, same title, same day.
//
// ⚠️ IT IMPORTS THE REAL CASCADE (`lib/tmdb-runtime.ts`) rather than restating it. Restating it here
// is precisely the mistake being repaired — two copies of one derivation, drifting apart in silence.
// That is what the --experimental-strip-types flag is for.
//
// Idempotent: a row that already knows its runtime is left alone.

import { readFileSync } from "node:fs";
import { runtimeFromTmdb } from "../src/modules/watching/lib/tmdb-runtime.ts";

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
const MISSING_ONLY = process.argv.includes("--missing-only");
const rest = (path, init = {}) =>
  fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      "Accept-Profile": "watching",
      "Content-Profile": "watching",
      ...(init.headers ?? {}),
    },
  });

const res = await rest(
  "media_items?select=id,tmdb_id,type,title,runtime,episodes,season_aired,watched,in_progress,paused,dropped&is_reference=not.eq.true&limit=2000",
);
if (!res.ok) { console.error("READ FAILED", res.status, await res.text()); process.exit(1); }
const rows = await res.json();

// Only rows that actually bill hours — a want-to-watch entry has no time to lose.
const billing = rows.filter((r) => r.watched || r.in_progress || r.paused || r.dropped);
const candidates = billing.filter((r) => {
  if (!(r.runtime > 0)) return true;                 // always fill a hole
  if (MISSING_ONLY) return false;
  return r.type !== "film";                          // and re-measure shows, never films
});

console.log(
  `${rows.length} rows · ${billing.length} billing hours · ${candidates.length} to check` +
  `${MISSING_ONLY ? " (missing only)" : ""}\n`,
);
if (candidates.length === 0) { console.log("Nothing to do."); process.exit(0); }

let filled = 0, changed = 0, same = 0, stillUnknown = 0, failed = 0;
let minutesBefore = 0, minutesAfter = 0;

for (const r of candidates) {
  const isFilm = r.type === "film";
  const base = `https://api.themoviedb.org/3/${isFilm ? "movie" : "tv"}/${r.tmdb_id}?api_key=${TMDB_KEY}`;
  let d;
  try {
    const tr = await fetch(base);
    if (!tr.ok) throw new Error(`HTTP ${tr.status}`);
    d = await tr.json();

    /**
     * THE WHOLE SHOW, NOT JUST ITS FIRST SEASON.
     *
     * The app appends `season/1` because it cannot know how many seasons exist before the response
     * lands, and will not pay a second round trip on a click. A script can. And it matters: episode
     * lengths drift over a show's life — Stranger Things runs 51 minutes in season 1 and closer to
     * 78 in season 4, so season 1 alone would trade one bias (a double-length finale) for another
     * (an undercount on everything that grew).
     *
     * TMDB accepts up to 20 appends, which covers every show here but One Piece; past that the
     * sample is already far larger than it needs to be.
     */
    const n = Math.min(d.number_of_seasons ?? 1, 20);
    if (!isFilm && n >= 1) {
      const seasons = Array.from({ length: n }, (_, i) => `season/${i + 1}`).join(",");
      // ⚠️ DO NOT SWALLOW A FAILED SEASON FETCH. When this quietly kept the seasonless `d`, the
      // cascade fell all the way to `last_episode_to_air` — the finale, which is very often
      // double-length. The Wire got 94 (its feature-length finale) instead of its 59 median, a
      // silent corruption the diagnostic later caught. A rate-limited batch is exactly when this
      // fires, so it retries once and then SKIPS the row rather than writing a wrong number.
      let sr = await fetch(`${base}&append_to_response=${seasons}`);
      if (!sr.ok) { await new Promise((r) => setTimeout(r, 500)); sr = await fetch(`${base}&append_to_response=${seasons}`); }
      if (!sr.ok) {
        console.log(`  ⏭ ${r.title.slice(0, 32).padEnd(34)} season fetch failed twice → skipped, not guessed`);
        failed++;
        continue;
      }
      d = await sr.json();
    }
  } catch (e) {
    console.log(`  ✗ ${r.title.slice(0, 32).padEnd(34)} TMDB failed (${e.message})`);
    failed++;
    continue;
  }

  // ⚠️ ONLY OVERWRITE WITH STRONGLY-MEASURED DATA. `append_to_response` is best-effort: under batch
  // load TMDB returns a 200 with the seasons SILENTLY MISSING, and `runtimeFromTmdb` would then fall
  // to the finale's length (The Wire got 94 for its 59-minute show that way — a 200 that lied).
  // The live add path may take that weak fallback because a null is worse than a guess at add time;
  // a repair must not, because it would replace a value with a wrong one. So: for a series, count
  // the real episode samples ourselves, and skip the row unless we actually have three.
  if (!isFilm) {
    const samples = Object.entries(d)
      .filter(([k]) => /^season\/\d+$/.test(k))
      .flatMap(([, v]) => (v?.episodes ?? []).map((e) => e?.runtime ?? 0))
      .filter((n) => n > 0);
    if (samples.length < 3) {
      console.log(`  ⏭ ${r.title.slice(0, 32).padEnd(34)} only ${samples.length} episode samples → skipped, not guessed`);
      failed++;
      continue;
    }
  }

  const runtime = runtimeFromTmdb(d, isFilm);
  if (runtime == null) {
    // Genuinely unknown (nothing announced, nothing aired). Leave it null — never write 0, which
    // would be a claim rather than an absence.
    if (!(r.runtime > 0)) { console.log(`  – ${r.title.slice(0, 32).padEnd(34)} TMDB doesn't know either → left null`); stillUnknown++; }
    continue;
  }
  if (runtime === r.runtime) { same++; continue; }

  // How many hours this row's correction moves, so the report says what it costs and not just
  // which numbers differ.
  const eps = (r.season_aired ?? []).reduce((a, b) => a + (b || 0), 0) || r.episodes || 1;
  const was = (r.runtime ?? 0) * (isFilm ? 1 : eps);
  const now = runtime * (isFilm ? 1 : eps);
  minutesBefore += was;
  minutesAfter += now;

  const delta = (now - was) / 60;
  const tag = r.runtime > 0 ? `${r.runtime} → ${runtime} min` : `${runtime} min (was empty)`;
  console.log(
    `  ${APPLY ? "✓" : "→"} ${r.title.slice(0, 32).padEnd(34)} ${tag.padEnd(22)}` +
    `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}h  [${r.type}]`,
  );

  if (APPLY) {
    const up = await rest(`media_items?id=eq.${r.id}`, {
      method: "PATCH",
      body: JSON.stringify({ runtime }),
    });
    if (!up.ok) { console.log(`      WRITE FAILED ${up.status} ${await up.text()}`); failed++; continue; }
  }
  if (r.runtime > 0) changed++; else filled++;
  // Gentle on TMDB — the append calls in a tight loop are what made it start dropping seasons.
  await new Promise((res) => setTimeout(res, 120));
}

console.log(
  `\n${APPLY ? "APPLIED" : "DRY RUN"} — ${filled} filled · ${changed} re-measured · ${same} already right` +
  ` · ${stillUnknown} unknown · ${failed} failed`,
);
console.log(
  `Net effect on Hours Watched: ${((minutesAfter - minutesBefore) / 60).toFixed(1)}h ` +
  `(${(minutesBefore / 60).toFixed(1)}h → ${(minutesAfter / 60).toFixed(1)}h across the rows that move)`,
);
if (!APPLY && (filled || changed)) console.log("Re-run with --apply to write.");
