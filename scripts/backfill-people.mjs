// One-off backfill for Person pages: ensure every title stores the TMDB **id** of its
// directors (older rows stored only {name, profile_url}), and fill cast_members where
// missing. Person pages match "your titles with X" on that id inside the jsonb.
//
//   node scripts/backfill-people.mjs
//
// Idempotent: a row is processed only if its cast is missing OR any stored director
// lacks an id. Safe to re-run. Reads env from .env.local.

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
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TMDB_KEY     = process.env.TMDB_API_KEY;
if (!SUPABASE_URL || !SERVICE_KEY || !TMDB_KEY) {
  console.error("Missing env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TMDB_API_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  db: { schema: "watching" },
  auth: { persistSession: false },
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const missing = (a) => !Array.isArray(a) || a.length === 0;
const dirsNeedId = (d) => Array.isArray(d) && d.length > 0 && d.some((x) => x?.id == null);
const PROFILE = (path, size) => (path ? `https://image.tmdb.org/t/p/${size}${path}` : null);

async function tmdbDetails(type, tmdbId) {
  const path = type === "film" ? "movie" : "tv";
  const res = await fetch(
    `https://api.themoviedb.org/3/${path}/${tmdbId}?api_key=${TMDB_KEY}&language=en-US&append_to_response=credits,aggregate_credits`,
  );
  if (!res.ok) throw new Error(`TMDB ${res.status}`);
  return res.json();
}

const buildDirectors = (d, isMovie) =>
  isMovie
    ? (d.credits?.crew ?? [])
        .filter((m) => m.job === "Director")
        .map((x) => ({ id: x.id, name: x.name, profile_url: PROFILE(x.profile_path, "w200") }))
    : (d.created_by ?? []).map((c) => ({ id: c.id, name: c.name, profile_url: PROFILE(c.profile_path, "w200") }));

async function main() {
  const { data: items, error } = await supabase
    .from("media_items")
    .select("id, title, tmdb_id, type, cast_members, directors");
  if (error) throw error;

  const targets = (items ?? []).filter(
    (i) => i.tmdb_id && (missing(i.cast_members) || dirsNeedId(i.directors)),
  );
  console.log(`${targets.length} items to backfill (of ${items?.length ?? 0} total).`);

  let ok = 0, fail = 0;
  for (const item of targets) {
    try {
      const isMovie = item.type === "film";
      const d = await tmdbDetails(item.type, item.tmdb_id);
      const update = {};

      if (missing(item.cast_members)) {
        const rawCast = isMovie ? (d.credits?.cast ?? []) : (d.aggregate_credits?.cast ?? []);
        const cast = rawCast.slice(0, 12).map((p) => ({
          id: p.id,
          name: p.name,
          character: p.character ?? p.roles?.[0]?.character ?? null,
          profile_url: PROFILE(p.profile_path, "w185"),
        }));
        if (cast.length > 0) update.cast_members = cast;
      }

      if (dirsNeedId(item.directors)) update.directors = buildDirectors(d, isMovie);

      if (Object.keys(update).length === 0) { console.log(`–  ${item.title}: nothing to write`); continue; }

      const { error: upErr } = await supabase.from("media_items").update(update).eq("id", item.id);
      if (upErr) throw upErr;
      ok++;
      console.log(`✓  ${item.title}: ${Object.keys(update).join(", ")}`);
      await sleep(120);
    } catch (e) {
      fail++;
      console.log(`✗  ${item.title} (tmdb ${item.tmdb_id}): ${e.message}`);
    }
  }
  console.log(`\nDone. ${ok} updated, ${fail} failed.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
