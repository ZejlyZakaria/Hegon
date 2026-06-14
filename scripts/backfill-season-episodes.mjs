// One-off backfill: populate watching.media_items.season_episodes (+ seasons, episodes)
// from TMDB for every series/anime that is missing it. Older items were added without
// the per-season episode breakdown, which the Hours-per-season stats + the Watch
// History editor need.
//
//   node scripts/backfill-season-episodes.mjs
//
// Idempotent: only touches rows where season_episodes is null/empty. Safe to re-run.
// Reads NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TMDB_API_KEY from .env.local.

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

// ── Load .env.local (no dotenv dependency) ────────────────────────────────────
function loadEnv(path) {
  try {
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m && process.env[m[1]] === undefined) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    }
  } catch { /* file optional */ }
}
loadEnv(".env.local");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TMDB_KEY     = process.env.TMDB_API_KEY;

if (!SUPABASE_URL || !SERVICE_KEY || !TMDB_KEY) {
  console.error("Missing env: need NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TMDB_API_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  db: { schema: "watching" },
  auth: { persistSession: false },
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function tmdbTv(tmdbId) {
  const res = await fetch(`https://api.themoviedb.org/3/tv/${tmdbId}?api_key=${TMDB_KEY}&language=en-US`);
  if (!res.ok) throw new Error(`TMDB ${res.status}`);
  return res.json();
}

async function main() {
  const { data: items, error } = await supabase
    .from("media_items")
    .select("id, title, tmdb_id, type, season_episodes, season_posters, season_air_dates")
    .in("type", ["serie", "anime"]);
  if (error) throw error;

  const missing = (a) => !Array.isArray(a) || a.length === 0;
  const targets = (items ?? []).filter(
    (i) => i.tmdb_id && (missing(i.season_episodes) || missing(i.season_posters) || missing(i.season_air_dates)),
  );
  console.log(`${targets.length} series/anime to backfill (of ${items?.length ?? 0} total).`);

  let ok = 0, skip = 0, fail = 0;
  for (const item of targets) {
    try {
      const tv = await tmdbTv(item.tmdb_id);
      const realSeasons = (tv.seasons ?? []).filter((s) => s.season_number > 0); // drop "Specials"
      const seasonEpisodes = realSeasons.map((s) => s.episode_count ?? 0);
      const seasonPosters  = realSeasons.map((s) => s.poster_path ?? null);
      const seasonAirDates = realSeasons.map((s) => s.air_date ?? null);
      if (seasonEpisodes.length === 0) {
        skip++;
        console.log(`–  ${item.title}: no seasons on TMDB`);
        continue;
      }
      const totalEps = seasonEpisodes.reduce((a, b) => a + b, 0);
      const { error: upErr } = await supabase
        .from("media_items")
        .update({ season_episodes: seasonEpisodes, season_posters: seasonPosters, season_air_dates: seasonAirDates, seasons: seasonEpisodes.length, episodes: totalEps })
        .eq("id", item.id);
      if (upErr) throw upErr;
      ok++;
      console.log(`✓  ${item.title}: ${seasonEpisodes.length} seasons · ${totalEps} eps`);
      await sleep(120); // stay gentle with the TMDB rate limit
    } catch (e) {
      fail++;
      console.log(`✗  ${item.title} (tmdb ${item.tmdb_id}): ${e.message}`);
    }
  }

  console.log(`\nDone. ${ok} updated, ${skip} skipped, ${fail} failed.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
