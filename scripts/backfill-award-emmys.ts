/// <reference lib="deno.ns" />
// One-off backfill: the Emmys, 1949 → today, from emmys.com into watching.awards — the same code
// the `watching-awards-sync` robot runs monthly for one year, without its time budget. Runs AFTER
// migration 20260915000300 (source / match columns, nullable work_tmdb_id).
//
//   deno run -A scripts/backfill-award-emmys.ts            # every year
//   deno run -A scripts/backfill-award-emmys.ts 2020 2026  # a range
//   deno run -A scripts/backfill-award-emmys.ts --unresolved  # re-resolve only the rows with match = none
//
// Replaces the Wikidata-sourced Emmy rows once the new ones are in (they were a third of the truth).
// Prints the resolution rate: how many nominees found their TMDB id by ID (Wikidata), by NAME
// (TMDB search), or not at all. Reads .env.local. Posters: run backfill-award-posters.mjs after.

import { fetchEmmyYear, makeResolver, type EmmyCategory, type EmmyRow } from "../supabase/functions/watching-awards-sync/emmys.ts";

const env: Record<string, string> = {};
for (const line of Deno.readTextFileSync(".env.local").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL, KEY = env.SUPABASE_SERVICE_ROLE_KEY, TMDB_KEY = env.TMDB_API_KEY;
if (!URL_ || !KEY || !TMDB_KEY) { console.error("missing env"); Deno.exit(1); }

const read = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Accept-Profile": "watching" };
const write = { ...read, "Content-Type": "application/json", "Content-Profile": "watching", Prefer: "resolution=merge-duplicates,return=minimal" };

const [fromArg, toArg] = Deno.args;
if (fromArg === "--unresolved") { await reresolve(); Deno.exit(0); }
const from = Number(fromArg ?? 1949), to = Number(toArg ?? new Date().getFullYear());

const catRes = await fetch(`${URL_}/rest/v1/award_categories?select=key,subject,emmy_slug&ceremony=eq.emmys&emmy_slug=not.is.null&order=rank`, { headers: read });
const cats: EmmyCategory[] = await catRes.json();
console.log(`${cats.length} Emmy categories · years ${from}–${to}`);

const resolver = makeResolver(TMDB_KEY);
const stats = { rows: 0, id: 0, name: 0, none: 0, personsNoId: 0 };
const unresolved = new Map<string, number>();
const t0 = Date.now();

for (let year = from; year <= to; year++) {
  let rows: EmmyRow[];
  try {
    rows = await fetchEmmyYear(year, cats, resolver);
  } catch (e) {
    console.log(`${year}: FAILED ${String(e).slice(0, 120)} — retrying once`);
    await new Promise((r) => setTimeout(r, 3000));
    rows = await fetchEmmyYear(year, cats, resolver);
  }
  for (let i = 0; i < rows.length; i += 500) {
    const up = await fetch(`${URL_}/rest/v1/awards?on_conflict=ceremony,category,year,work_qid,person_qid`, {
      method: "POST", headers: write, body: JSON.stringify(rows.slice(i, i + 500).map((r) => ({ ...r, synced_at: new Date().toISOString() }))),
    });
    if (!up.ok) { console.error(`${year}: upsert failed ${up.status} ${(await up.text()).slice(0, 200)}`); Deno.exit(1); }
  }
  for (const r of rows) {
    stats.rows++; stats[r.match]++;
    if (r.person_qid && !r.person_tmdb_id) stats.personsNoId++;
    if (r.match === "none") unresolved.set(r.work_title, (unresolved.get(r.work_title) ?? 0) + 1);
  }
  console.log(`${year}: ${rows.length} rows · ${Math.round((Date.now() - t0) / 1000)} s`);
}

console.log(`\ndone: ${stats.rows} rows · resolved by id ${stats.id} · by name ${stats.name} · unresolved ${stats.none} · people without id ${stats.personsNoId}`);
console.log("unresolved titles (top 30):", [...unresolved.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30).map(([t, n]) => `${t} ×${n}`).join(" | "));

// The Wikidata Emmy rows are now the lesser copy: drop them so a series is not listed twice.
if (from <= 1949) {
  const del = await fetch(`${URL_}/rest/v1/awards?ceremony=eq.emmys&source=eq.wikidata`, { method: "DELETE", headers: { ...write, Prefer: "return=minimal" } });
  console.log("deleted the Wikidata-sourced Emmy rows:", del.status);
}

/** Second chance for the rows that found no TMDB id — after a resolver improvement, not a re-download. */
async function reresolve() {
  const resolver = makeResolver(TMDB_KEY!);
  const rows: { id: number; work_qid: string; work_title: string; work_type: "film" | "serie"; category: string; year: number }[] = [];
  for (let from = 0; ; from += 1000) {
    const r = await fetch(`${URL_}/rest/v1/awards?select=id,work_qid,work_title,work_type,category,year&source=eq.emmys&match=eq.none&order=year.desc`, { headers: { ...read, Range: `${from}-${from + 999}` } });
    const page = r.ok ? await r.json() : [];
    rows.push(...page);
    if (page.length < 1000) break;
  }
  const works = new Map<string, typeof rows[number]>();
  for (const r of rows) if (!works.has(r.work_qid)) works.set(r.work_qid, r);
  console.log(`${rows.length} unresolved rows · ${works.size} distinct works`);
  let fixed = 0; const still: string[] = [];
  for (const w of works.values()) {
    const kind = w.work_type === "film" ? "movie" : "tv";
    const { tmdb, match, kind: found } = await resolver.work(w.work_title, kind, w.year);
    if (!tmdb) { still.push(w.work_title); continue; }
    const realKind = found ?? kind;
    const up = await fetch(`${URL_}/rest/v1/awards?work_qid=eq.${encodeURIComponent(w.work_qid)}&source=eq.emmys`, {
      method: "PATCH", headers: { ...write, Prefer: "return=minimal" },
      body: JSON.stringify({ work_tmdb_id: tmdb, match, work_type: realKind === "movie" ? "film" : "serie" }),
    });
    if (up.ok) fixed++;
  }
  console.log(`re-resolved ${fixed} works · still unresolved ${still.length}:`, still.slice(0, 40).join(" | "));
}
