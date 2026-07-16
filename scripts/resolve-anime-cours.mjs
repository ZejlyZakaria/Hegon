// Anime v2 — resolve the AniList season overlay for every anime in the library.
//
//   node scripts/resolve-anime-cours.mjs           → DRY RUN. Prints the seasons it would store.
//   node scripts/resolve-anime-cours.mjs --apply    → upsert into watching.anime_cours.
//
// PIPELINE (verified feasible on JJK + Blue Lock):
//   1. Fribb anime-lists  → tmdb_id → the AniList ids of every TV season (curated community mapping).
//   2. AniList GraphQL    → each season's episode count, air date, title, poster.
//   3. Order by air date, cumulative-sum the episodes → each season's TMDB flat-episode range.
//   4. Validate the sum against TMDB's total episode count; flag any mismatch instead of trusting it.
// No mapping / no data → source 'none' (cached), and the app keeps TMDB's flat structure.

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

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !SERVICE_KEY) { console.error("Missing Supabase env"); process.exit(1); }
const APPLY = process.argv.includes("--apply");
const supabase = createClient(URL, SERVICE_KEY, { db: { schema: "watching" } });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const dateKey = (d) => (d?.year ?? 9999) * 10000 + (d?.month ?? 99) * 100 + (d?.day ?? 99);

// ── 1. Fribb mapping (tmdb_id → AniList ids) ────────────────────────────────────
console.log("Fetching Fribb anime-lists mapping…");
const fribb = await (await fetch("https://raw.githubusercontent.com/Fribb/anime-lists/master/anime-list-full.json")).json();
const anilistIdsForTmdb = (tmdbId) => {
  const ids = new Set();
  for (const e of fribb) {
    if (e.type === "TV" && e.themoviedb_id && e.themoviedb_id.tv === tmdbId && e.anilist_id) ids.add(e.anilist_id);
  }
  return [...ids];
};

// ── AniList batch fetch (retries on 429 using Retry-After) ──────────────────────
async function anilistByIds(ids, attempt = 0) {
  const query = `query($ids:[Int]){ Page(perPage:50){ media(id_in:$ids, type:ANIME){ id episodes startDate{year month day} endDate{year} title{romaji english} coverImage{extraLarge large} } } }`;
  const res = await fetch("https://graphql.anilist.co", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables: { ids } }),
  });
  if (res.status === 429 && attempt < 5) {
    const wait = (parseInt(res.headers.get("retry-after") || "0", 10) || 60) * 1000;
    console.log(`   …rate-limited, waiting ${wait / 1000}s`);
    await sleep(wait + 500);
    return anilistByIds(ids, attempt + 1);
  }
  if (!res.ok) throw new Error(`AniList ${res.status}`);
  return (await res.json()).data?.Page?.media ?? [];
}

// ── 2. Every distinct anime in the library ──────────────────────────────────────
const { data: rows, error } = await supabase
  .from("media_items").select("tmdb_id, title, episodes")
  .eq("type", "anime").not("tmdb_id", "is", null);
if (error) { console.error(error); process.exit(1); }
const byTmdb = new Map();
for (const r of rows) if (!byTmdb.has(r.tmdb_id)) byTmdb.set(r.tmdb_id, r);
console.log(`${byTmdb.size} distinct anime.${APPLY ? "" : "  (DRY RUN)"}\n`);

let resolved = 0, none = 0, mismatch = 0;
for (const [tmdbId, info] of byTmdb) {
  const ids = anilistIdsForTmdb(tmdbId);
  if (ids.length === 0) {
    none++;
    console.log(`— ${info.title} (tmdb ${tmdbId}): no AniList mapping → flat TMDB (source 'none')`);
    if (APPLY) await supabase.from("anime_cours").upsert({ tmdb_id: tmdbId, cours: [], source: "none", resolved_at: new Date().toISOString() });
    continue;
  }
  let media;
  try { media = await anilistByIds(ids); } catch (e) { console.log(`! ${info.title}: ${e.message}`); continue; }
  await sleep(700); // AniList rate-limit courtesy

  media.sort((a, b) => dateKey(a.startDate) - dateKey(b.startDate));
  const cours = [];
  let cursor = 0;
  for (let i = 0; i < media.length; i++) {
    const m = media[i];
    const eps = m.episodes ?? null;
    const start = cursor + 1;
    const end = eps ? cursor + eps : null;
    if (eps) cursor += eps;
    cours.push({
      season: i + 1,
      anilist_id: m.id,
      title: m.title.english || m.title.romaji,
      poster_url: m.coverImage?.extraLarge || m.coverImage?.large || null,
      year: m.startDate?.year ?? null,
      end_year: m.endDate?.year ?? null,   // floors "year watched" — a cour ending in 2024 can't be dated 2023
      episodes: eps,
      start_episode: start,
      end_episode: end,
    });
  }

  const sum = cours.reduce((a, c) => a + (c.episodes ?? 0), 0);
  const tmdbTotal = info.episodes ?? null;
  const ok = tmdbTotal == null || sum === tmdbTotal;
  if (!ok) mismatch++;
  resolved++;
  console.log(`${ok ? "✓" : "⚠"} ${info.title} (tmdb ${tmdbId}) — ${cours.length} seasons, AniList sum=${sum}${tmdbTotal != null ? ` / TMDB=${tmdbTotal}` : ""}${ok ? "" : "  ← MISMATCH"}`);
  for (const c of cours) console.log(`     S${c.season}  ep ${c.start_episode}-${c.end_episode ?? "?"}  (${c.episodes ?? "airing"})  ${c.year ?? ""}  ${c.title}`);

  if (APPLY) {
    // A mismatch means the AniList boundaries won't line up with TMDB's episode list, so the UI must
    // NOT apply the overlay. We still store it (source 'mismatch') so it's cached + inspectable, but
    // only source 'anilist' is trusted for the real season split. Match → 'anilist'.
    const source = ok ? "anilist" : "mismatch";
    const { error: upErr } = await supabase.from("anime_cours").upsert({ tmdb_id: tmdbId, cours, source, resolved_at: new Date().toISOString() });
    if (upErr) console.error(`   ! write failed: ${upErr.message}`);
  }
}

console.log(`\nDone. ${resolved} resolved, ${none} unmapped, ${mismatch} episode-count mismatch(es).${APPLY ? " Written." : " (dry run — pass --apply to write)"}`);
