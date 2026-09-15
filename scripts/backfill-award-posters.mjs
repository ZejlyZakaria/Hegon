// One-off backfill: give every watching.awards work its `poster_path` + `work_year`, and every
// credited person their `person_profile_path`, from TMDB —
// the same pass the `watching-awards-sync` robot runs monthly, without its time budget. Runs after
// the Wikidata backfill (`call_edge('watching-awards-sync', {ceremony, since})`).
//
//   node scripts/backfill-award-posters.mjs
//
// One TMDB call per WORK (type + tmdb id), not per row: a film nominated in six categories is
// fetched once and patched everywhere. A dead TMDB id is stamped "" so nobody asks again.
// Idempotent. Reads NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TMDB_API_KEY from .env.local.

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const { NEXT_PUBLIC_SUPABASE_URL: URL_, SUPABASE_SERVICE_ROLE_KEY: KEY, TMDB_API_KEY } = process.env;
if (!URL_ || !KEY || !TMDB_API_KEY) { console.error("missing env"); process.exit(1); }
const sb = createClient(URL_, KEY, { db: { schema: "watching" }, auth: { persistSession: false } });

// Every row still missing a poster, paged past PostgREST's 1 000-row cap.
const works = new Map();
for (let from = 0; ; from += 1000) {
  const { data, error } = await sb.from("awards").select("work_type, work_tmdb_id").is("poster_path", null).not("work_tmdb_id", "is", null).range(from, from + 999);
  if (error) throw error;
  for (const r of data) works.set(`${r.work_type}:${r.work_tmdb_id}`, r);
  if (data.length < 1000) break;
}
const list = [...works.values()];
console.log(`${list.length} works without a poster`);

let done = 0, gone = 0, failed = 0, i = 0;
const t0 = Date.now();
const worker = async () => {
  while (i < list.length) {
    const w = list[i++];
    const path = w.work_type === "film" ? `movie/${w.work_tmdb_id}` : `tv/${w.work_tmdb_id}`;
    let r;
    for (let attempt = 0; attempt < 3; attempt++) {
      r = await fetch(`https://api.themoviedb.org/3/${path}?api_key=${TMDB_API_KEY}`);
      if (r.status !== 429) break;
      await new Promise((res) => setTimeout(res, 1500));
    }
    // Only a definite 404 is "dead"; anything else is retried next run (leave it null).
    if (!r.ok && r.status !== 404) { failed++; continue; }
    const d = r.ok ? await r.json() : null;
    const poster = d?.poster_path ?? "";
    const date = d?.release_date ?? d?.first_air_date ?? null;
    const year = date ? Number(String(date).slice(0, 4)) || null : null;
    if (!d) gone++;
    const { error } = await sb.from("awards").update({ poster_path: poster, work_year: year }).eq("work_type", w.work_type).eq("work_tmdb_id", w.work_tmdb_id);
    if (error) { failed++; continue; }
    done++;
    if (done % 200 === 0) console.log(`  ${done}/${list.length} · ${Math.round((Date.now() - t0) / 1000)} s`);
  }
};
await Promise.all(Array.from({ length: 8 }, worker));
console.log(`works: done ${done} · dead ids ${gone} · failed ${failed} · ${Math.round((Date.now() - t0) / 1000)} s`);

// ── People: one TMDB call per person, patched on every row that credits them ──
const people = new Set();
for (let from = 0; ; from += 1000) {
  const { data, error } = await sb.from("awards").select("person_tmdb_id").not("person_tmdb_id", "is", null).is("person_profile_path", null).range(from, from + 999);
  if (error) throw error;
  for (const r of data) people.add(r.person_tmdb_id);
  if (data.length < 1000) break;
}
const plist = [...people];
console.log(`${plist.length} people without a portrait`);
let pdone = 0, pfailed = 0, pi = 0;
const t1 = Date.now();
const pworker = async () => {
  while (pi < plist.length) {
    const id = plist[pi++];
    let r;
    for (let attempt = 0; attempt < 3; attempt++) {
      r = await fetch(`https://api.themoviedb.org/3/person/${id}?api_key=${TMDB_API_KEY}`);
      if (r.status !== 429) break;
      await new Promise((res) => setTimeout(res, 1500));
    }
    if (!r.ok && r.status !== 404) { pfailed++; continue; }
    const d = r.ok ? await r.json() : null;
    const { error } = await sb.from("awards").update({ person_profile_path: d?.profile_path ?? "" }).eq("person_tmdb_id", id);
    if (error) { pfailed++; continue; }
    pdone++;
    if (pdone % 500 === 0) console.log(`  ${pdone}/${plist.length} · ${Math.round((Date.now() - t1) / 1000)} s`);
  }
};
await Promise.all(Array.from({ length: 8 }, pworker));
console.log(`people: done ${pdone} · failed ${pfailed} · ${Math.round((Date.now() - t1) / 1000)} s`);
