// deno-lint-ignore-file no-explicit-any
import { providerRefreshSucceeded } from "../_shared/provider-progress.ts";
import { fetchAllRows } from "../_shared/pagination.ts";
import { batchOutcome } from "../_shared/batch-outcome.ts";
import { compactSeason, type SeasonEvidence } from "../_shared/provider-evidence.ts";
// Fetch compact episode membership; the transactional provider command alone classifies changes
// and projects accepted world facts. Counts/status/max dates cannot reopen personal posture.
// Batches remain bounded by work, not personal rows. No complete provider payload is archived.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { fetchWithRetry, errMsg } from "../_shared/retry.ts";

const TMDB = "https://api.themoviedb.org/3";
const KEY = Deno.env.get("TMDB_API_KEY")!;

/** SHOWS per invocation (not rows — see selectBatch). Sized to finish well inside the wall clock. */
const BATCH = 25;

/**
 * ⚠️ COMPUTED PER RUN, NOT PER ISOLATE.
 *
 * As a module-level `const`, this froze the moment the isolate booted — and a warm isolate can
 * outlive midnight. The job would then spend hours counting with yesterday's date, so an episode
 * that aired TONIGHT stayed invisible until the isolate happened to be recycled. Precisely the
 * evening where freshness is the whole point of the job.
 */
const today = () => new Date().toISOString().slice(0, 10);

const FINISHED = new Set(["ended", "canceled", "cancelled"]);
const isFinished = (s: unknown) => FINISHED.has(String(s ?? "").toLowerCase());
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function tmdb(path: string): Promise<any> {
  const qs = new URLSearchParams({ api_key: KEY, language: "en-US" });
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetchWithRetry(`${TMDB}/${path}?${qs}`);
    if (res.status === 429) { await sleep(1000 * (attempt + 1)); continue; }
    if (!res.ok) throw new Error(`TMDB ${res.status} on ${path}`);
    return res.json();
  }
  throw new Error(`TMDB rate-limited on ${path}`);
}

interface ProviderHead { work_key:string; accepted_snapshot_id:string|null; checked_at:string }
interface SeasonFacts { evidence: SeasonEvidence; poster: string | null; airDate: string | null }

// Full membership reads also discover removals with unchanged counts. Never reuse bare totals.
async function seasonFacts(
  tmdbId: number,
  seasons: any[],
): Promise<SeasonFacts[]> {
  const out: SeasonFacts[] = [];
  const TODAY = today();
  let precedingEpisodes=0;

  for (let i = 0; i < seasons.length; i++) {
    const s = seasons[i];
    if(s.season_number!==i+1) throw new Error("Noncontiguous season identities");
    // The poster and the start date come free with the show payload — no season call needed. They
    // are why `useSeasonRefresh` existed, firing a TMDB request on every detail-page open to write
    // the ANNOUNCED counts and never the aired ones. This job already knows everything that hook
    // knew, and more, so the hook is gone.
    const poster = s.poster_path ?? null;

    const detail = await tmdb(`tv/${tmdbId}/season/${s.season_number}`);
    if (!Array.isArray(detail.episodes)) throw new Error("Incomplete season response");
    if(detail.id!=null && detail.id!==s.id || detail.season_number!=null && detail.season_number!==s.season_number) throw new Error("Season identity mismatch");
    const evidence = compactSeason(s, detail.episodes, TODAY,precedingEpisodes);
    precedingEpisodes+=s.episode_count;
    const airDate = evidence.episodes.filter((e) => e.aired === true && e.air_date).map((e) => e.air_date!).sort()[0] ?? s.air_date ?? null;
    out.push({ evidence, poster, airDate });
    await sleep(60);   // TMDB is generous, not infinite
  }

  return out;
}

// `recently_watched` was dropped (Last Watched derives from watched_at now). It lingered here after
// the column was gone, and this SELECT is the first thing the job does — so every run since has died
// on "column does not exist", silently: net.http_post is async, so the cron still reports success.
const ROW_COLUMNS =
  "id,title,tmdb_id,status,watched,in_progress,paused,dropped,current_season," +
  "current_episode,season_episodes,season_aired,season_end_dates,caught_up_at,watched_at,last_synced_at";

/** How stale a title has to be before it's worth asking TMDB again. */
const ONGOING_STALE_MS = 6 * 60 * 60 * 1000;        // a show that's airing: a few times a day
const BOOTSTRAP_RETRY_MS = 10 * 60 * 1000; // A corrected initial observation can retry without a six-hour lockout.
const FINISHED_STALE_MS = 7 * 24 * 60 * 60 * 1000;  // a show that's over: once a week, for revivals

const staleness = (rows: any[]) => {
  // The group is as stale as its OLDEST row — otherwise a row could be starved forever behind a
  // freshly-written sibling.
  let oldest = Infinity;
  for (const r of rows) {
    const t = r.last_synced_at ? new Date(r.last_synced_at).getTime() : 0;   // never synced = infinitely stale
    if (t < oldest) oldest = t;
  }
  return Date.now() - oldest;
};

function groupByShow(rows: any[]): Map<number, any[]> {
  const groups = new Map<number, any[]>();
  for (const r of rows) {
    const g = groups.get(r.tmdb_id);
    if (g) g.push(r); else groups.set(r.tmdb_id, [r]);
  }
  return groups;
}

/**
 * THE BATCH — chosen by SERIES, and by URGENCY.
 *
 * ── ONE SHOW IS ONE FETCH ─────────────────────────────────────────────────────────────────────
 * `media_items` is per-user, so the same show exists once per account: 239 rows for 124 distinct
 * series. The job used to walk ROWS, so it asked TMDB "where is House of the Dragon?" twice, to be
 * told the same thing twice — half the calls in a full pass were pure waste.
 *
 * And that waste hid a real defect. `status` and `season_aired` are facts about THE WORLD; they do
 * not belong to you. Yet each copy was refreshed independently, at its own place in the rotation —
 * so the day episode 5 airs, your row learns it at 10:00 and the demo's at 18:00, and for eight
 * hours the same show has TWO DIFFERENT TRUTHS in one database. Fetching once and writing to every
 * row that shares the tmdb_id makes that impossible by construction, not by luck.
 * (The proper cure is a shared `series_facts(tmdb_id)` table — the world's truth stored ONCE, with
 * media_items keeping only what is yours. This is the first step of it.)
 *
 * ── AND NOT EVERY SHOW DESERVES THE SAME ATTENTION ────────────────────────────────────────────
 * 180 of the 239 rows are FINISHED. Re-verifying every ten hours that Breaking Bad is still over is
 * absurd, and it was crowding out the 15 shows that actually air an episode this week. So finished
 * shows are checked weekly (revivals are real, but they are not hourly), and the batch goes to what
 * moves.
 */
async function selectBatch(supabase: any) {
  const pick = async (finished: boolean) => {
    const build = () => {
      let q = supabase
      .from("media_items")
      .select(ROW_COLUMNS)
      .neq("type", "film")
      .eq("is_reference", false)
      .not("tmdb_id", "is", null);
    q = finished
      ? q.in("status", ["ended", "canceled", "cancelled"])
      : q.or("status.is.null,status.not.in.(ended,canceled,cancelled)");
    return q;
    };
    const data = await fetchAllRows<any>((from, to) => build().order("last_synced_at", { ascending: true, nullsFirst: true }).order("id").range(from, to));
    return (data ?? []) as any[];
  };

  const [ongoing,finished,heads,rewatches]=await Promise.all([
    pick(false),pick(true),
    fetchAllRows<ProviderHead>((from,to)=>supabase.from("provider_heads").select("work_key,accepted_snapshot_id,checked_at").eq("provider","tmdb").order("work_key").range(from,to)),
    fetchAllRows<{media_item_id:string}>((from,to)=>supabase.from("rewatches").select("media_item_id").order("id").range(from,to)),
  ]);
  const byWork=new Map<string,ProviderHead>(heads.map((head):[string,ProviderHead]=>[head.work_key,head]));
  const rewatchIds=new Set(rewatches.map(r=>r.media_item_id));
  const ready=(id:number)=>{
    const head=byWork.get(`tv:${id}`);
    return !head || !!head.accepted_snapshot_id || Date.now()-new Date(head.checked_at).getTime()>=BOOTSTRAP_RETRY_MS;
  };
  const all=[...groupByShow([...ongoing,...finished]).entries()];
  // A fresh legacy cache is not an accepted episode catalogue. Seed missing evidence
  // independently of the weekly finished-show timer; preserve room for normal airing work.
  const bootstrap=all.filter(([id])=>!byWork.get(`tv:${id}`)?.accepted_snapshot_id && ready(id))
    .sort((a,b)=>Number(b[1].some(r=>rewatchIds.has(r.id)))-Number(a[1].some(r=>rewatchIds.has(r.id))) || staleness(b[1])-staleness(a[1]))
    .slice(0,Math.ceil(BATCH/2));
  const selected=new Set(bootstrap.map(([id])=>id));
  const eligible=(rows:any[],maxAge:number)=>[...groupByShow(rows).entries()]
    .filter(([id,g])=>!selected.has(id) && ready(id) && staleness(g)>=maxAge)
    .sort((a,b)=>staleness(b[1])-staleness(a[1]));
  const batch=bootstrap;
  for(const group of eligible(ongoing,ONGOING_STALE_MS)) {
    if(batch.length>=BATCH) break;
    selected.add(group[0]);batch.push(group);
  }
  for(const group of eligible(finished,FINISHED_STALE_MS)) {
    if(batch.length>=BATCH) break;
    selected.add(group[0]);batch.push(group);
  }

  return batch;
}

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("HEGON_SECRET_KEY")!,
    { db: { schema: "watching" }, global: { fetch: fetchWithRetry } },
  );

  try {
    const batch = await selectBatch(supabase);

    let succeeded = 0;
    let changed = 0, repaired = 0, failed = 0, rows = 0;
    const log: string[] = [];

    for (const [tmdbId, group] of batch) {
      const title = group[0].title;
      rows += group.length;

      let show: any;
      try {
        show = await tmdb(`tv/${tmdbId}`);
      } catch (e) {
        failed++;
        await supabase.rpc("observe_provider", { command: { provider: "tmdb", work_key: `tv:${tmdbId}`, error_code: "PROVIDER_FAILURE" } });
        log.push(`✗ ${title}: ${errMsg(e)}`);
        continue;
      }

      if (!show || typeof show !== "object" || !Array.isArray(show.seasons) || show.id !== tmdbId || !show.status) {
        failed++; log.push(`${title}: invalid show response`);
        await supabase.rpc("observe_provider", { command: { provider: "tmdb", work_key: `tv:${tmdbId}`, error_code: "INVALID_RESPONSE" } });
        continue;
      }
      const seasons = show.seasons.filter((s: any) => s.season_number > 0).sort((a: any,b: any) => a.season_number-b.season_number);
      const raw = String(show.status).toLowerCase();
      const status = isFinished(raw) ? (raw === "ended" ? "ended" : "canceled") : "ongoing";
      let facts: SeasonFacts[];
      try {
        facts = await seasonFacts(tmdbId, seasons);
      } catch (error) {
        failed++; log.push(`${title}: ${errMsg(error)}`);
        await supabase.rpc("observe_provider", { command: { provider: "tmdb", work_key: `tv:${tmdbId}`, error_code: "PROVIDER_FAILURE" } }); continue;
      }
      const { data: evidence, error } = await supabase.rpc("observe_provider", { command: {
        provider: "tmdb", work_key: `tv:${tmdbId}`, facts: { status, seasons: facts.map((f) => f.evidence) },
        projection: { season_posters: facts.map((f) => f.poster), season_air_dates: facts.map((f) => f.airDate) },
      } });
      if (error || !providerRefreshSucceeded(evidence)) {
        failed++; log.push(`${title}: ${error?.message ?? evidence?.reason_code ?? evidence?.classification}`); continue;
      }
      if (evidence.accepted) changed++;
      if (evidence.growth) repaired++;
      succeeded++;
      log.push(`${title}: ${evidence.classification}`);

    }

    const result = batchOutcome(succeeded, failed);
    return new Response(
      JSON.stringify({ ...result, shows: batch.length, rows, changed, repaired, failed, log }),
      { status: result.status, headers: { "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: errMsg(e) }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
});
