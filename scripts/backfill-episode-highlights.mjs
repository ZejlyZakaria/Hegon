// One-off backfill: give every watching.episode_highlights row its `air_date` + `overview` (and a
// `title` / `still_path` where they are missing) from TMDB. Runs AFTER the migration
// 20260914000000_episode_highlights_air_date_overview.sql has added the two columns.
//
//   node scripts/backfill-episode-highlights.mjs            # only rows still missing air_date
//   node scripts/backfill-episode-highlights.mjs --all      # re-stamp every row
//
// One TMDB call per (title, season), not per episode: 648 rows are ~120 seasons. Idempotent.
// Reads NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TMDB_API_KEY from .env.local.

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadEnv(path) {
  try {
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
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
const ALL = process.argv.includes("--all");

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: "watching" }, auth: { persistSession: false } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function tmdbSeason(tmdbId, season) {
  const res = await fetch(`https://api.themoviedb.org/3/tv/${tmdbId}/season/${season}?api_key=${TMDB_KEY}&language=en-US`);
  if (!res.ok) throw new Error(`TMDB ${res.status}`);
  return res.json();
}

async function main() {
  let q = supabase.from("episode_highlights").select("id, media_item_id, season, episode, title, still_path, air_date");
  if (!ALL) q = q.is("air_date", null);
  const { data: rows, error } = await q;
  if (error) throw error;

  const mediaIds = [...new Set(rows.map((r) => r.media_item_id))];
  const { data: media, error: mErr } = await supabase.from("media_items").select("id, title, tmdb_id").in("id", mediaIds);
  if (mErr) throw mErr;
  const byMedia = new Map(media.map((m) => [m.id, m]));

  // Group by (title, season) → one season fetch covers every starred episode in it.
  const groups = new Map();
  for (const r of rows) {
    const key = `${r.media_item_id}:${r.season}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }
  console.log(`${rows.length} rows to stamp across ${groups.size} seasons of ${mediaIds.length} titles.`);

  let ok = 0, fail = 0, miss = 0;
  for (const [key, group] of groups) {
    const m = byMedia.get(group[0].media_item_id);
    if (!m?.tmdb_id) { miss += group.length; console.log(`–  ${key}: no tmdb_id`); continue; }
    try {
      const season = await tmdbSeason(m.tmdb_id, group[0].season);
      const eps = new Map((season.episodes ?? []).map((e) => [e.episode_number, e]));
      for (const r of group) {
        const e = eps.get(r.episode);
        if (!e) { miss++; console.log(`–  ${m.title} S${r.season}E${r.episode}: not on TMDB`); continue; }
        const patch = {
          air_date: e.air_date ?? null,
          overview: e.overview ?? null,
          ...(r.title ? {} : { title: e.name ?? null }),
          ...(r.still_path ? {} : { still_path: e.still_path ?? null }),
        };
        const { error: upErr } = await supabase.from("episode_highlights").update(patch).eq("id", r.id);
        if (upErr) throw upErr;
        ok++;
      }
      console.log(`✓  ${m.title} S${group[0].season}: ${group.length} rows`);
      await sleep(120);
    } catch (e) {
      fail += group.length;
      console.log(`✗  ${m.title} S${group[0].season}: ${e.message}`);
    }
  }
  console.log(`\nDone. ${ok} stamped, ${miss} not found, ${fail} failed.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
