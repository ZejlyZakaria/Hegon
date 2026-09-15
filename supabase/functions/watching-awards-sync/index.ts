// supabase/functions/watching-awards-sync/index.ts
//
// THE MUSEUM's robot — Oscars and Emmys, winners and nominees, from Wikidata into
// watching.awards. The categories (and their Wikidata QIDs) are read from
// watching.award_categories: the whitelist lives in the database, not here.
//
// Two ways to run it:
//   · monthly cron, no payload → the last two ceremony years only (cheap, idempotent upsert);
//   · by hand, `{ "ceremony": "oscars", "since": 1929 }` → the full backfill of one ceremony.
//     One ceremony per invocation: ~20 SPARQL queries of 1–8 s each stay well inside the
//     function's wall-clock budget; both at once would not.
//   · `{ "enrich": true }` → only the TMDB pass (poster + release year for works still missing
//     one), time-boxed; run it a few times after a backfill, the monthly cron finishes the tail.
// Payload: { ceremony?: "oscars" | "emmys", since?: number, categories?: string[], enrich?: boolean }.
//
// Reads HEGON_SECRET_KEY, never the auto-injected service-role key (CLAUDE.md §6bis). Invoked by
// a cron via internal.call_edge('watching-awards-sync', payload).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { fetchWithRetry, errMsg } from "../_shared/retry.ts";
import { fetchCategory, type AwardCategory, type AwardRow } from "./wikidata.ts";

const BATCH = 500;
// The enrichment stops itself before the function's wall-clock budget does.
const ENRICH_BUDGET_MS = 100_000;
const TMDB = "https://api.themoviedb.org/3";

serve(async (req) => {
  const startedAt = Date.now();
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const KEY = Deno.env.get("HEGON_SECRET_KEY");
    if (!SUPABASE_URL || !KEY) return new Response("Missing environment variables", { status: 500 });

    let payload: { ceremony?: string; since?: number; categories?: string[]; enrich?: boolean } = {};
    try { payload = await req.json(); } catch { /* no body = the cron's default run */ }
    const since = Number.isFinite(payload.since) ? Number(payload.since) : new Date().getFullYear() - 1;

    const readHeaders = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Accept-Profile": "watching" };
    const writeHeaders = {
      ...readHeaders,
      "Content-Type": "application/json",
      "Content-Profile": "watching",
      Prefer: "resolution=merge-duplicates,return=minimal",
    };

    const report: Record<string, { rows: number; wins: number; ms: number } | { error: string }> = {};
    let total = 0;

    if (!payload.enrich) {
      // The whitelist, from the database.
      let catUrl = `${SUPABASE_URL}/rest/v1/award_categories?select=key,ceremony,subject,qids&order=rank`;
      if (payload.ceremony) catUrl += `&ceremony=eq.${payload.ceremony}`;
      if (payload.categories?.length) catUrl += `&key=in.(${payload.categories.join(",")})`;
      const catRes = await fetchWithRetry(catUrl, { headers: readHeaders });
      if (!catRes.ok) throw new Error(`award_categories fetch failed: ${await catRes.text()}`);
      const cats: AwardCategory[] = await catRes.json();

      for (const cat of cats) {
        const t0 = Date.now();
        try {
          const rows: AwardRow[] = await fetchCategory(cat, since, fetchWithRetry);
          for (let i = 0; i < rows.length; i += BATCH) {
            const up = await fetchWithRetry(
              `${SUPABASE_URL}/rest/v1/awards?on_conflict=ceremony,category,year,work_qid,person_qid`,
              { method: "POST", headers: writeHeaders, body: JSON.stringify(rows.slice(i, i + BATCH).map((r) => ({ ...r, synced_at: new Date().toISOString() }))) },
            );
            if (!up.ok) throw new Error(`upsert failed: ${up.status} ${await up.text()}`);
          }
          total += rows.length;
          report[cat.key] = { rows: rows.length, wins: rows.filter((r) => r.won).length, ms: Date.now() - t0 };
        } catch (e) {
          // One category failing must not lose the others: Wikidata times out per query.
          report[cat.key] = { error: errMsg(e) };
          console.error(`awards-sync ${cat.key}: ${errMsg(e)}`);
        }
        // Be a polite SPARQL client.
        await new Promise((res) => setTimeout(res, 500));
    }
    }

    // ── TMDB pass: poster + release year, for works that have none yet ──
    const enrich = await enrichPosters(SUPABASE_URL, readHeaders, writeHeaders, startedAt);

    const failed = Object.values(report).filter((r) => "error" in r).length;
    const body = { ok: failed === 0, since, ceremony: payload.ceremony ?? "all", failed, rows: total, enrich, ms: Date.now() - startedAt, report };
    return new Response(JSON.stringify(body), { status: failed === 0 ? 200 : 207, headers: { "Content-Type": "application/json" } });
  } catch (e) {
    console.error("awards-sync fatal:", errMsg(e));
    return new Response(JSON.stringify({ ok: false, error: errMsg(e) }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});

/**
 * Fill `poster_path` + `work_year` from TMDB for every (work_type, work_tmdb_id) still missing
 * one, a few at a time, until the time budget is spent. One TMDB call per WORK (not per row):
 * a film nominated in six categories is fetched once and patched everywhere.
 */
async function enrichPosters(url: string, readHeaders: Record<string, string>, writeHeaders: Record<string, string>, startedAt: number) {
  const TMDB_KEY = Deno.env.get("TMDB_API_KEY");
  if (!TMDB_KEY) return { skipped: "no TMDB_API_KEY" };
  // ⚠️ PostgREST caps a response at 1 000 rows whatever `limit` says — the first version asked for
  // 3 000, got 1 000 lines (~300 works, one line per credit), reported "remaining 0" against that
  // window, and left 11 000 rows without a poster. Page with Range until a short page.
  const byWork = new Map<string, { work_type: "film" | "serie"; work_tmdb_id: number }>();
  for (let from = 0; ; from += 1000) {
    const res = await fetchWithRetry(`${url}/rest/v1/awards?select=work_type,work_tmdb_id&poster_path=is.null&order=year.desc`, { headers: { ...readHeaders, Range: `${from}-${from + 999}` } });
    if (!res.ok && res.status !== 416) return { error: `missing-posters fetch failed: ${res.status}` };
    const rows: { work_type: "film" | "serie"; work_tmdb_id: number }[] = res.ok ? await res.json() : [];
    for (const r of rows) byWork.set(`${r.work_type}:${r.work_tmdb_id}`, r);
    if (rows.length < 1000) break;
  }
  const works = [...byWork.values()];
  let done = 0, gone = 0;
  const CONCURRENCY = 6;
  let i = 0;
  const worker = async () => {
    while (i < works.length && Date.now() - startedAt < ENRICH_BUDGET_MS) {
      const w = works[i++];
      const path = w.work_type === "film" ? `movie/${w.work_tmdb_id}` : `tv/${w.work_tmdb_id}`;
      const r = await fetch(`${TMDB}/${path}?api_key=${TMDB_KEY}`);
      // A TMDB id Wikidata holds can be dead (merged, deleted): a 404 is stamped "" so we stop
      // asking. Anything else (429, 5xx) is NOT a verdict — leave it null for the next run.
      if (!r.ok && r.status !== 404) continue;
      const d = r.ok ? await r.json() : null;
      const poster = d?.poster_path ?? "";
      const date = d?.release_date ?? d?.first_air_date ?? null;
      const year = date ? Number(String(date).slice(0, 4)) || null : null;
      if (!d) gone++;
      const up = await fetchWithRetry(
        `${url}/rest/v1/awards?work_type=eq.${w.work_type}&work_tmdb_id=eq.${w.work_tmdb_id}`,
        { method: "PATCH", headers: { ...writeHeaders, Prefer: "return=minimal" }, body: JSON.stringify({ poster_path: poster, work_year: year }) },
      );
      if (up.ok) done++;
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return { works: works.length, done, gone, remaining: works.length - done };
}
