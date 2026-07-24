// PUT BACK THE ORIGINAL ARTWORK.
//
//   node scripts/refresh-artwork.mjs           → DRY RUN, writes nothing
//   node scripts/refresh-artwork.mjs --apply   → actually writes
//
// WHY
// `src/app/api/tmdb/route.ts` forces `language=en-US` on every call today, with the comment "kills
// the FR→EN flash and stops FR titles/overviews being stored". Rows added BEFORE that line carry
// whatever TMDB served for French: localised posters with the title burned into the artwork, and
// backdrops that have since been replaced. Delete such a title and re-add it and the original comes
// back — which is the whole proof that the fix is just "ask again, in English".
//
// ⛔ THREE THINGS THIS MUST NOT DO
//   1. TOUCH A POSTER YOU CHOSE YOURSELF. `uploadCustomPoster` stores hand-picked art in Supabase
//      Storage, and there is no way to get it back once overwritten. Anything that is not an
//      `image.tmdb.org` URL is skipped, loudly.
//   2. TOUCH ANIME. Their artwork is entangled with the AniList cour overlay (cour posters come
//      from AniList, not TMDB), and re-pointing the show poster underneath that is a different
//      question. Owner's explicit call: films and series only.
//   3. WRITE WHEN TMDB HAS NOTHING. A null `poster_path` means "no answer", never "clear the field".
//
// Idempotent: a row already holding the English artwork is left alone.

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

/** The `/t/p/<size>/<file>` tail of a TMDB image URL, or null when this is not TMDB's to replace. */
function tmdbFile(url) {
  if (!url) return null;
  const m = String(url).match(/image\.tmdb\.org\/t\/p\/[^/]+(\/.+)$/);
  return m ? m[1] : null;
}

const res = await rest(
  "media_items?select=id,tmdb_id,type,title,poster_url,backdrop_url&is_reference=not.eq.true&type=in.(film,serie)&limit=2000",
);
if (!res.ok) { console.error("READ FAILED", res.status, await res.text()); process.exit(1); }
const rows = await res.json();

console.log(`${rows.length} films + series (anime deliberately excluded)\n`);

let updated = 0, already = 0, custom = 0, noAnswer = 0, failed = 0;

for (const r of rows) {
  if (!r.tmdb_id) { continue; }

  // A poster you uploaded is not TMDB's to overwrite, and it is not recoverable.
  if (r.poster_url && !tmdbFile(r.poster_url)) {
    console.log(`  ⊘ ${r.title.slice(0, 34).padEnd(36)} custom poster — skipped`);
    custom++;
    continue;
  }

  const endpoint = r.type === "film" ? "movie" : "tv";
  let d;
  try {
    const tr = await fetch(`https://api.themoviedb.org/3/${endpoint}/${r.tmdb_id}?api_key=${TMDB_KEY}&language=en-US`);
    if (!tr.ok) throw new Error(`HTTP ${tr.status}`);
    d = await tr.json();
  } catch (e) {
    console.log(`  ✗ ${r.title.slice(0, 34).padEnd(36)} TMDB failed (${e.message})`);
    failed++;
    continue;
  }

  // Sizes match what the app stores at add time (see `mapTmdbDetails`), so nothing downstream has
  // to learn a second convention. `tmdbImageFor` re-sizes at render anyway.
  const poster = d.poster_path ? `https://image.tmdb.org/t/p/w500${d.poster_path}` : null;
  const backdrop = d.backdrop_path ? `https://image.tmdb.org/t/p/original${d.backdrop_path}` : null;

  if (!poster && !backdrop) { noAnswer++; continue; }

  const patch = {};
  if (poster && tmdbFile(poster) !== tmdbFile(r.poster_url)) patch.poster_url = poster;
  if (backdrop && tmdbFile(backdrop) !== tmdbFile(r.backdrop_url)) patch.backdrop_url = backdrop;

  if (Object.keys(patch).length === 0) { already++; continue; }

  const what = [patch.poster_url && "poster", patch.backdrop_url && "backdrop"].filter(Boolean).join(" + ");
  console.log(`  ${APPLY ? "✓" : "→"} ${r.title.slice(0, 34).padEnd(36)} ${what}`);
  if (patch.poster_url) console.log(`        ${tmdbFile(r.poster_url) ?? "(none)"}  →  ${tmdbFile(patch.poster_url)}`);

  if (APPLY) {
    const up = await rest(`media_items?id=eq.${r.id}`, { method: "PATCH", body: JSON.stringify(patch) });
    if (!up.ok) { console.log(`      WRITE FAILED ${up.status} ${await up.text()}`); failed++; continue; }
  }
  updated++;
}

console.log(
  `\n${APPLY ? "APPLIED" : "DRY RUN"} — ${updated} refreshed · ${already} already original · ` +
  `${custom} custom (skipped) · ${noAnswer} TMDB had nothing · ${failed} failed`,
);
if (!APPLY && updated > 0) console.log("Re-run with --apply to write.");
