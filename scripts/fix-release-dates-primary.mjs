// CORRECTIVE backfill — set every watchlist film's release_date to TMDB's PRIMARY date.
//
//   node scripts/fix-release-dates-primary.mjs           → DRY RUN. Shows every change, writes nothing.
//   node scripts/fix-release-dates-primary.mjs --apply    → actually writes.
//
// WHY
// An earlier backfill wrote the US THEATRICAL date (release_dates type 3) — The Odyssey became
// 2026-07-17 instead of TMDB's own 2026-07-15. We've since decided on ONE source of truth: TMDB's
// primary `release_date` field (the value shown on Google and the detail page). This resets every
// want-to-watch film to that field, overwriting the theatrical values and filling legacy nulls.
// Idempotent.

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
const TMDB_KEY = process.env.TMDB_API_KEY;
if (!URL || !SERVICE_KEY || !TMDB_KEY) {
  console.error("Missing env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TMDB_API_KEY");
  process.exit(1);
}
const APPLY = process.argv.includes("--apply");
const supabase = createClient(URL, SERVICE_KEY, { db: { schema: "watching" } });

const { data: films, error } = await supabase
  .from("media_items")
  .select("id, title, tmdb_id, release_date")
  .eq("type", "film")
  .eq("want_to_watch", true);
if (error) { console.error(error); process.exit(1); }

console.log(`${films.length} want-to-watch films.${APPLY ? "" : "  (DRY RUN — pass --apply to write)"}\n`);
let changed = 0;
for (const f of films) {
  if (!f.tmdb_id) { console.log(`  skip "${f.title}" — no tmdb_id`); continue; }
  const res = await fetch(`https://api.themoviedb.org/3/movie/${f.tmdb_id}?api_key=${TMDB_KEY}`);
  if (!res.ok) { console.log(`  skip "${f.title}" — TMDB ${res.status}`); continue; }
  const primary = (await res.json()).release_date?.slice(0, 10) || null;
  if (primary && primary !== f.release_date) {
    console.log(`  ${f.release_date ?? "(null)"} → ${primary}   ${f.title}`);
    changed++;
    if (APPLY) {
      const { error: upErr } = await supabase.from("media_items").update({ release_date: primary }).eq("id", f.id);
      if (upErr) console.error(`    ! failed: ${upErr.message}`);
    }
  }
}
console.log(`\n${changed} film(s) ${APPLY ? "updated" : "would change"}.`);
