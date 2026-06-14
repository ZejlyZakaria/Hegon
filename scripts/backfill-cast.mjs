// One-off backfill: populate watching.media_items.cast_members (+ directors when
// missing) from TMDB for every item that doesn't have a cached cast yet. After this,
// the detail page renders Cast & Crew straight from the DB with no TMDB call.
//
//   node scripts/backfill-cast.mjs
//
// Idempotent: only touches rows where cast_members is empty. Safe to re-run.
// REQUIRES the 20260614_media_cast.sql migration applied first.
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
const missing = (a) => !Array.isArray(a) || a.length === 0;
const PROFILE = (path, size) => (path ? `https://image.tmdb.org/t/p/${size}${path}` : null);

async function tmdbDetails(type, tmdbId) {
  const path = type === "film" ? "movie" : "tv";
  const res = await fetch(
    `https://api.themoviedb.org/3/${path}/${tmdbId}?api_key=${TMDB_KEY}&language=en-US&append_to_response=credits,aggregate_credits`,
  );
  if (!res.ok) throw new Error(`TMDB ${res.status}`);
  return res.json();
}

async function main() {
  const { data: items, error } = await supabase
    .from("media_items")
    .select("id, title, tmdb_id, type, cast_members, directors");
  if (error) throw error;

  const targets = (items ?? []).filter((i) => i.tmdb_id && missing(i.cast_members));
  console.log(`${targets.length} items to backfill cast (of ${items?.length ?? 0} total).`);

  let ok = 0, skip = 0, fail = 0;
  for (const item of targets) {
    try {
      const isMovie = item.type === "film";
      const d = await tmdbDetails(item.type, item.tmdb_id);

      // Cast: movies on credits.cast, TV/anime recurring cast on aggregate_credits.cast.
      const rawCast = isMovie ? (d.credits?.cast ?? []) : (d.aggregate_credits?.cast ?? []);
      const cast = rawCast.slice(0, 12).map((p) => ({
        id: p.id,
        name: p.name,
        character: p.character ?? p.roles?.[0]?.character ?? null,
        profile_url: PROFILE(p.profile_path, "w185"),
      }));

      if (cast.length === 0) {
        skip++;
        console.log(`–  ${item.title}: no cast on TMDB`);
        continue;
      }

      const update = { cast_members: cast };

      // Backfill directors too, but only if the row doesn't already have them.
      if (missing(item.directors)) {
        update.directors = isMovie
          ? (d.credits?.crew ?? [])
              .filter((m) => m.job === "Director")
              .map((x) => ({ name: x.name, profile_url: PROFILE(x.profile_path, "w200") }))
          : (d.created_by ?? []).map((c) => ({ name: c.name, profile_url: PROFILE(c.profile_path, "w200") }));
      }

      const { error: upErr } = await supabase.from("media_items").update(update).eq("id", item.id);
      if (upErr) throw upErr;
      ok++;
      console.log(`✓  ${item.title}: ${cast.length} cast`);
      await sleep(120); // stay gentle with the TMDB rate limit
    } catch (e) {
      fail++;
      console.log(`✗  ${item.title} (tmdb ${item.tmdb_id}): ${e.message}`);
    }
  }

  console.log(`\nDone. ${ok} updated, ${skip} skipped, ${fail} failed.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
