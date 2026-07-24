// REPAIR THE ROWS THAT ARE WORTH ZERO HOURS.
//
//   node --experimental-strip-types scripts/repair-runtime.mjs           → DRY RUN, writes nothing
//   node --experimental-strip-types scripts/repair-runtime.mjs --apply   → actually writes
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
  "media_items?select=id,tmdb_id,type,title,runtime,watched,in_progress,paused,dropped&is_reference=not.eq.true&limit=2000",
);
if (!res.ok) { console.error("READ FAILED", res.status, await res.text()); process.exit(1); }
const rows = await res.json();

// Only rows that actually bill hours — a want-to-watch entry has no time to lose.
const broken = rows.filter(
  (r) => !(r.runtime > 0) && (r.watched || r.in_progress || r.paused || r.dropped),
);

console.log(`${rows.length} rows · ${broken.length} with no runtime\n`);
if (broken.length === 0) { console.log("Nothing to repair."); process.exit(0); }

let fixed = 0, stillUnknown = 0, failed = 0;

for (const r of broken) {
  const isFilm = r.type === "film";
  const url = `https://api.themoviedb.org/3/${isFilm ? "movie" : "tv"}/${r.tmdb_id}?api_key=${TMDB_KEY}`;
  let d;
  try {
    const tr = await fetch(url);
    if (!tr.ok) throw new Error(`HTTP ${tr.status}`);
    d = await tr.json();
  } catch (e) {
    console.log(`  ✗ ${r.title.padEnd(34)} TMDB failed (${e.message})`);
    failed++;
    continue;
  }

  const runtime = runtimeFromTmdb(d, isFilm);
  if (runtime == null) {
    // Genuinely unknown (nothing announced, nothing aired). Leave it null — never write 0, which
    // would be a claim rather than an absence.
    console.log(`  – ${r.title.padEnd(34)} TMDB doesn't know either → left null`);
    stillUnknown++;
    continue;
  }

  console.log(`  ${APPLY ? "✓" : "→"} ${r.title.padEnd(34)} ${runtime} min  [${r.type}]`);
  if (APPLY) {
    const up = await rest(`media_items?id=eq.${r.id}`, {
      method: "PATCH",
      body: JSON.stringify({ runtime }),
    });
    if (!up.ok) { console.log(`      WRITE FAILED ${up.status} ${await up.text()}`); failed++; continue; }
  }
  fixed++;
}

console.log(
  `\n${APPLY ? "APPLIED" : "DRY RUN"} — ${fixed} repaired · ${stillUnknown} still unknown · ${failed} failed`,
);
if (!APPLY && fixed > 0) console.log("Re-run with --apply to write.");
