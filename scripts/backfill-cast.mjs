// STORE THE WHOLE CAST, NOT JUST THE HEADLINE.
//
//   node scripts/backfill-cast.mjs           → DRY RUN, writes nothing
//   node scripts/backfill-cast.mjs --apply   → actually writes
//
// WHY
// A title's cast was stored capped at the top billed (a display choice). But the person-page ranking
// — "your #N most-watched actor" — counts every title an actor appears in from that stored cast, so a
// supporting part or a cameo billed below the cap simply did not count. Gary Oldman showed 9 titles
// in the grid (matched on his full filmography) yet was RANKED lower, because a real cameo can be
// billed dead last: he is #78 of 80 in Oppenheimer. There is NO honest cap — this stores the WHOLE
// cast, so the ranking agrees with the count shown. Backfills every row added before that.
//
// (This supersedes the June one-off that only filled EMPTY casts, at a depth of 12. The
// `cast_members` column already exists — migration 20260614_media_cast.sql — so this changes data,
// never schema.)
//
// ⛔ WHAT THIS MUST NOT DO
//   1. SHRINK a cast. It only writes when TMDB gives us MORE than is stored — never fewer.
//   2. CLOBBER with nothing. An empty cast from TMDB ("no answer") is skipped, never written.
//   3. Touch anything but `cast_members`. Same public world-fact for every owner; no personal state.
//
// Idempotent: a row already holding the whole cast is left alone on a re-run.

import { readFileSync } from "node:fs";

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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The same rule useMediaCredits.mapCredits uses: movies carry `credits.cast`; series/anime keep
// their recurring cast on `aggregate_credits` (character under roles[]), falling back to `credits`.
function fullCastFrom(d, type) {
  const credits = d?.credits ?? {};
  const aggregate = d?.aggregate_credits ?? {};
  const rawCast =
    type === "film" ? (credits.cast ?? []) : (aggregate.cast?.length ? aggregate.cast : (credits.cast ?? []));
  return rawCast.map((p) => ({
    id: p.id,
    name: p.name,
    character: p.character ?? p.roles?.[0]?.character ?? null,
    profile_url: p.profile_path ? `https://image.tmdb.org/t/p/w185${p.profile_path}` : null,
  }));
}

const res = await rest(
  "media_items?select=id,tmdb_id,type,title,cast_members&is_reference=not.eq.true&limit=5000",
);
if (!res.ok) { console.error("READ FAILED", res.status, await res.text()); process.exit(1); }
const rows = await res.json();

console.log(`${rows.length} titles scanned. Storing the whole cast (no cap).\n`);

let enriched = 0, alreadyFull = 0, noAnswer = 0, noTmdbId = 0, failed = 0;

for (const r of rows) {
  if (!r.tmdb_id) { noTmdbId++; continue; }
  const have = Array.isArray(r.cast_members) ? r.cast_members.length : 0;

  const endpoint = r.type === "film" ? "movie" : "tv";
  let d;
  try {
    const tr = await fetch(
      `https://api.themoviedb.org/3/${endpoint}/${r.tmdb_id}?api_key=${TMDB_KEY}&language=en-US&append_to_response=aggregate_credits,credits`,
    );
    if (!tr.ok) throw new Error(`HTTP ${tr.status}`);
    d = await tr.json();
  } catch (e) {
    console.log(`  ✗ ${r.title.slice(0, 34).padEnd(36)} TMDB failed (${e.message})`);
    failed++;
    await sleep(40);
    continue;
  }

  const cast = fullCastFrom(d, r.type);
  if (cast.length === 0) { noAnswer++; await sleep(40); continue; }      // never clobber with nothing
  if (cast.length <= have) { alreadyFull++; await sleep(40); continue; } // only ever enrich, never shrink

  console.log(`  ${APPLY ? "✓" : "→"} ${r.title.slice(0, 34).padEnd(36)} ${have} → ${cast.length} cast`);

  if (APPLY) {
    const up = await rest(`media_items?id=eq.${r.id}`, { method: "PATCH", body: JSON.stringify({ cast_members: cast }) });
    if (!up.ok) { console.log(`      WRITE FAILED ${up.status} ${await up.text()}`); failed++; await sleep(40); continue; }
  }
  enriched++;
  await sleep(40); // gentle on TMDB
}

console.log(
  `\n${APPLY ? "APPLIED" : "DRY RUN"} — ${enriched} enriched · ${alreadyFull} already full · ` +
  `${noAnswer} TMDB had no cast · ${noTmdbId} no tmdb_id · ${failed} failed`,
);
if (!APPLY && enriched > 0) console.log("Re-run with --apply to write.");
