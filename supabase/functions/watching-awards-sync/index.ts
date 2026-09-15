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
 * Fill from TMDB what Wikidata cannot give: `poster_path` + `work_year` for every work, and
 * `person_profile_path` for every credited person — a few at a time, until the time budget is
 * spent. One TMDB call per WORK / per PERSON (not per row): a film nominated in six categories is
 * fetched once and patched everywhere.
 */
async function enrichPosters(url: string, readHeaders: Record<string, string>, writeHeaders: Record<string, string>, startedAt: number) {
  const TMDB_KEY = Deno.env.get("TMDB_API_KEY");
  if (!TMDB_KEY) return { skipped: "no TMDB_API_KEY" };

  // ⚠️ PostgREST caps a response at 1 000 rows whatever `limit` says — the first version asked for
  // 3 000, got 1 000 lines (~300 works, one line per credit), reported "remaining 0" against that
  // window, and left 11 000 rows without a poster. Page with Range until a short page.
  const listMissing = async <T extends Record<string, unknown>>(query: string, keyOf: (r: T) => string): Promise<T[]> => {
    const by = new Map<string, T>();
    for (let from = 0; ; from += 1000) {
      const res = await fetchWithRetry(`${url}/rest/v1/awards?${query}`, { headers: { ...readHeaders, Range: `${from}-${from + 999}` } });
      if (!res.ok && res.status !== 416) throw new Error(`missing list failed: ${res.status}`);
      const rows: T[] = res.ok ? await res.json() : [];
      for (const r of rows) by.set(keyOf(r), r);
      if (rows.length < 1000) break;
    }
    return [...by.values()];
  };

  // A TMDB id Wikidata holds can be dead (merged, deleted): a 404 is stamped "" so we stop asking.
  // Anything else (429, 5xx) is NOT a verdict — the row stays null for the next run.
  const tmdb = async (path: string): Promise<Record<string, unknown> | null | undefined> => {
    const r = await fetch(`${TMDB}/${path}?api_key=${TMDB_KEY}`);
    if (r.ok) return await r.json();
    return r.status === 404 ? null : undefined;
  };
  const patch = (filter: string, body: Record<string, unknown>) =>
    fetchWithRetry(`${url}/rest/v1/awards?${filter}`, { method: "PATCH", headers: { ...writeHeaders, Prefer: "return=minimal" }, body: JSON.stringify(body) });
  const inBudget = () => Date.now() - startedAt < ENRICH_BUDGET_MS;
  const runAll = async (n: number, job: () => Promise<boolean>) => {
    let done = 0;
    await Promise.all(Array.from({ length: 6 }, async () => { while (n-- > 0 && inBudget()) { if (await job()) done++; } }));
    return done;
  };

  type Work = { work_type: "film" | "serie"; work_tmdb_id: number };
  const works = await listMissing<Work>("select=work_type,work_tmdb_id&poster_path=is.null&order=year.desc", (r) => `${r.work_type}:${r.work_tmdb_id}`);
  let wi = 0, gone = 0;
  const worksDone = await runAll(works.length, async () => {
    const w = works[wi++];
    const d = await tmdb(w.work_type === "film" ? `movie/${w.work_tmdb_id}` : `tv/${w.work_tmdb_id}`);
    if (d === undefined) return false;
    if (d === null) gone++;
    const date = (d?.release_date ?? d?.first_air_date ?? null) as string | null;
    const up = await patch(`work_type=eq.${w.work_type}&work_tmdb_id=eq.${w.work_tmdb_id}`, { poster_path: d?.poster_path ?? "", work_year: date ? Number(String(date).slice(0, 4)) || null : null });
    return up.ok;
  });

  type Person = { person_tmdb_id: number };
  const people = await listMissing<Person>("select=person_tmdb_id&person_tmdb_id=not.is.null&person_profile_path=is.null&order=year.desc", (r) => String(r.person_tmdb_id));
  let pi = 0;
  const peopleDone = await runAll(people.length, async () => {
    const p = people[pi++];
    const d = await tmdb(`person/${p.person_tmdb_id}`);
    if (d === undefined) return false;
    const up = await patch(`person_tmdb_id=eq.${p.person_tmdb_id}`, { person_profile_path: d?.profile_path ?? "" });
    return up.ok;
  });

  return { works: works.length, worksDone, gone, people: people.length, peopleDone, remaining: works.length - worksDone + people.length - peopleDone };
}
