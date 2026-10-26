import { compactSeason } from "../../../../supabase/functions/_shared/provider-evidence";
import { providerRefreshSucceeded } from "../../../../supabase/functions/_shared/provider-progress";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { fetchAllRows } from "./pagination";
import { batchOutcome } from "../../../../supabase/functions/_shared/batch-outcome";
import { creditRole } from "./credit-roles";

// Execute the real Deno entrypoints; only provider transport and database boundaries are faked.
type Row = Record<string, unknown>;
type Query = { finished?: boolean; table: string; op: string; values?: Row | Row[]; person?: number; from: number; to: number };
type ProviderReply = { data: Row; error: unknown };
type ProviderInput = { command: { provider: string; work_key: string; facts?: Row; projection?: Row } };
type Reply = { data: Row[] | null; error: unknown };
function database(run: (q: Query) => Reply, observe?: (params: ProviderInput) => ProviderReply) {
  return { schema() { return this; }, async rpc(_name: string, params: ProviderInput) {
    if (observe) return observe(params);
    if (!params.command.facts) return { data: { classification: "FAILED" }, error: null };
    if (params.command.provider === "anilist") {
      const result = run({ table: "anime_cours", op: "upsert", values: { tmdb_id: Number(params.command.work_key.split(":")[1]), cours: params.command.projection?.cours, source: "anilist" }, from: 0, to: 999 });
      return { data: { classification: "BASELINE", accepted: true, growth: false }, error: result.error };
    }
    return { data: { classification: "BASELINE", accepted: true, growth: false }, error: null };
  }, from(table: string) {
    const q: Query = { table, op: "select", from: 0, to: 999 };
    const chain = {
      select() { return this; }, neq() { return this; }, in(key: string) { if (key === "status") q.finished=true; return this; }, or() { q.finished=false; return this; }, order() { return this; }, not() { return this; }, gte() { return this; },
      eq(key: string, value: number) { if (key === "person_tmdb_id") q.person = value; return this; },
      range(from: number, to: number) { q.from = from; q.to = to; return this; },
      delete() { q.op = "delete"; return this; },
      upsert(values: Row | Row[]) { q.op = "upsert"; q.values = values; return this; },
      update(values: Row) { q.op = "update"; q.values = values; return this; },
      then(done: (r: Reply) => unknown, fail?: (e: unknown) => unknown) { return Promise.resolve().then(() => run(q)).then(done, fail); },
    };
    return chain;
  } };
}
function handler(name: string, db: ReturnType<typeof database>, fetcher: (url: string, init?: RequestInit) => Promise<Response>) {
  let serve!: (req: Request) => Promise<Response>;
  const source = readFileSync(resolve(`supabase/functions/${name}/index.ts`), "utf8");
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const dependencies: Record<string, unknown> = {
    "https://esm.sh/@supabase/supabase-js@2": { createClient: () => db },
    "../_shared/retry.ts": { fetchWithRetry: fetcher, errMsg: (e: unknown) => e instanceof Error ? e.message : String(e) },
    "../_shared/pagination.ts": { fetchAllRows }, "../_shared/batch-outcome.ts": { batchOutcome },
    "../_shared/credit-roles.ts": { creditRole },
    "../_shared/provider-progress.ts": { providerRefreshSucceeded },
    "../_shared/provider-evidence.ts": { compactSeason },
    // Unreleased-title refresh is a separate job, outside these person-cache regressions.
    "./unreleased.ts": { refreshUnreleased: async () => ({ scanned: 0, updated: 0, failed: 0 }) },
  };
  runInNewContext(js, {
    exports: {}, require: (id: string) => { if (!(id in dependencies)) throw new Error(`Unexpected import ${id}`); return dependencies[id]; },
    Deno: { env: { get: () => "test" }, serve: (fn: typeof serve) => { serve = fn; } },
    Response, Request, URLSearchParams, console: { error() {} }, setTimeout: (fn: () => void) => { fn(); return 0; },
  });
  return async (body = {}) => {
    const response = await serve(new Request("https://test.invalid", { method: "POST", body: JSON.stringify(body) }));
    return { status: response.status, body: await response.json() };
  };
}
const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }));
const oldCour = { tmdb_id: 1, cours: [{ season: 1, episodes: 10 }], source: "anilist", resolved_at: "2020-01-01" };
const valid = { data: { Page: { media: [{ id: 101, episodes: 10, startDate: { year: 2022 }, endDate: { year: 2022 }, title: { english: "Anime", romaji: null }, coverImage: null }] } } };
function anime(responses: unknown[], mapped = true, mappingFailure?: "http" | "shape", hasCache = true) {
  const cache = new Map<number, Row>((hasCache ? responses : []).map((_, i) => [i + 1, { ...oldCour, tmdb_id: i + 1 }]));
  const writes: Query[] = [];
  let providerCalls = 0;
  const db = database((q) => {
    if (q.op === "upsert") { writes.push(q); const row = q.values as typeof oldCour; cache.set(row.tmdb_id, row); return { data: null, error: null }; }
    const rows = q.table === "media_items" ? responses.map((_, i) => ({ tmdb_id: i + 1, title: `Anime ${i}`, status: "ongoing", episodes: 10 })) : [...cache.values()];
    return { data: rows.slice(q.from, q.to + 1), error: null };
  }, (params) => {
    const tmdbId = Number(params.command.work_key.split(":")[1]);
    if (!params.command.facts) return { data: { classification: "FAILED", growth: false }, error: null };
    const cours = params.command.projection?.cours as Row[];
    if (cours.length === 0 && cache.has(tmdbId)) return { data: { classification: "REGRESSION", growth: false }, error: null };
    const row = { tmdb_id: tmdbId, cours, source: cours.length ? "anilist" : "none", resolved_at: "2026-10-13" };
    writes.push({ table: "anime_cours", op: "upsert", values: row, from: 0, to: 999 }); cache.set(tmdbId,row);
    return { data: { classification: "BASELINE", growth: false, accepted: true }, error: null };
  });
  const run = handler("watching-anime-cours-sync", db, (url, init) => {
    if (url.includes("githubusercontent")) {
      if (mappingFailure === "http") return json([], 503);
      if (mappingFailure === "shape") return json({ error: "Unavailable" });
      return json(mapped ? responses.map((_, i) => ({ type: "TV", themoviedb_id: { tv: i + 1 }, anilist_id: 101 + i })) : []);
    }
    providerCalls++;
    const id = JSON.parse(String(init?.body)).variables.ids[0];
    const body = responses[id - 101];
    return body === "malformed JSON" ? Promise.resolve(new Response("{")) : json(body);
  });
  return { run, cache, writes, providerCalls: () => providerCalls };
}
describe("AniList actual handler", () => {
  it.each(["http", "shape"] as const)("preserves cache on mapping %s failure", async (failure) => {
    const h = anime([valid], true, failure);
    expect((await h.run()).status).toBe(500);
    expect(h.writes).toHaveLength(0);
    expect(h.cache.get(1)).toEqual(oldCour);
    expect(h.providerCalls()).toBe(0);
  });
  it("writes validated provider data", async () => {
    const h = anime([valid]);
    expect(await h.run()).toMatchObject({ status: 200, body: { resolved: 1, failed: 0, ok: true } });
    expect(h.cache.get(1)?.cours).toEqual([expect.objectContaining({ anilist_id: 101, episodes: 10 })]);
  });
  it("retains accepted mapping when a structurally valid empty result removes it", async () => {
    const h = anime([{ data: { Page: { media: [] } } }]);
    expect(await h.run()).toMatchObject({ status: 500, body: { failed: 1 } });
    expect(h.cache.get(1)).toEqual(oldCour);
    expect(h.writes).toHaveLength(0);
  });
  it("keeps no mapping distinct from a failed AniList request", async () => {
    const h = anime([valid], false, undefined, false);
    expect(await h.run()).toMatchObject({ status: 200, body: { none: 1, failed: 0 } });
    expect(h.providerCalls()).toBe(0);
    expect(h.cache.get(1)?.source).toBe("none");
  });
  it.each([
    { errors: [{ message: "Unavailable" }] },
    { ...valid, errors: [{ message: "Partial GraphQL failure" }] },
    null, {}, { data: null }, { data: { Page: {} } }, { data: { Page: { media: {} } } },
    { data: { Page: { media: [null] } } }, { errors: "invalid", ...valid }, "malformed JSON",
  ])("rejects semantic/malformed responses and preserves the old cache: %j", async (body) => {
    const h = anime([body]);
    expect(await h.run()).toMatchObject({ status: 500, body: { failed: 1, ok: false, outcome: "failure" } });
    expect(h.writes).toHaveLength(0);
    expect(h.cache.get(1)).toEqual(oldCour);
  });
  it("reports partial failure and writes only the valid item", async () => {
    const h = anime([valid, { errors: [{ message: "Failed" }] }]);
    expect(await h.run()).toMatchObject({ status: 207, body: { resolved: 1, failed: 1, outcome: "partial" } });
    expect(h.writes).toHaveLength(1);
    expect(h.cache.get(2)).toEqual({ ...oldCour, tmdb_id: 2 });
  });
  it("reports complete substantive failure across multiple items", async () => {
    const h = anime([{}, { errors: [{ message: "Failed" }] }]);
    expect(await h.run()).toMatchObject({ status: 500, body: { failed: 2 } });
    expect(h.writes).toHaveLength(0);
  });
});
function people(seasonFailure = false, profileFailure = false, primaryFailure = false) {
  const old = { person_tmdb_id: 1, tmdb_id: 10, media_type: "tv", season_number: 2, synced_at: "2020-01-01" };
  let cache: Row[] = [old];
  const writes: Query[] = [];
  const db = database((q) => {
    if (q.op === "select") return { data: [{ person_tmdb_id: 1 }], error: null };
    writes.push(q);
    if (q.table === "person_upcoming" && q.person === 1 && q.op === "delete") cache = [];
    if (q.table === "person_upcoming" && q.op === "upsert") cache = q.values as Row[];
    return { data: null, error: null };
  });
  const run = handler("watching-people-sync", db, (url) => {
    if (url.includes("combined_credits")) return primaryFailure ? json({}, 503) : json({ cast: [
      seasonFailure ? { id: 10, media_type: "tv", name: "Returning", first_air_date: "2020-01-01", episode_count: 3 }
        : { id: 20, media_type: "movie", title: "Upcoming", release_date: "2030-01-01", character: "Lead" },
    ] });
    if (url.includes("/tv/")) return json({}, 503);
    return profileFailure ? json({}, 503) : json({ name: "Person", known_for_department: "Acting" });
  });
  return { run, cache: () => cache, old, writes };
}
describe("People actual handler", () => {
  it("reports success after upcoming and profile writes", async () => {
    const h = people();
    expect(await h.run()).toMatchObject({ status: 200, body: { rows: 1, succeeded: 2, failed: [], secondaryFailures: [] } });
    const profile = h.writes.find((q) => q.table === "person_follows" && q.op === "update");
    expect(profile?.values).not.toHaveProperty("known_for"); // Retain creator/voice follow metadata.
  });
  it("reports partial success when upcoming writes succeed and profile refresh fails", async () => {
    const h = people(false, true);
    expect(await h.run()).toMatchObject({ status: 207, body: { rows: 1, succeeded: 1, failed: [], outcome: "partial" } });
    expect(h.cache()[0].tmdb_id).toBe(20);
  });
  it("retains the old upcoming slice and timestamp after a secondary season failure", async () => {
    const h = people(true);
    expect(await h.run()).toMatchObject({ status: 207, body: { rows: 0, succeeded: 1, retained: [1], outcome: "partial" } });
    expect(h.cache()).toEqual([h.old]);
    expect(h.writes.filter((q) => q.table === "person_upcoming" && (q.person === 1 || q.op === "upsert"))).toHaveLength(0);
  });
  it("reports failure when the retained slice is the only attempted substantive refresh", async () => {
    const h = people(true);
    expect(await h.run({ person: 1 })).toMatchObject({ status: 500, body: { rows: 0, succeeded: 0, retained: [1] } });
    expect(h.cache()).toEqual([h.old]);
  });
  it("preserves cache on primary failure and reports complete failure", async () => {
    const h = people(false, false, true);
    expect(await h.run()).toMatchObject({ status: 500, body: { failed: [1], succeeded: 0 } });
    expect(h.cache()).toEqual([h.old]);
  });
});


describe("series sync actual provenance boundary", () => {
  it.each(["GROWTH", "REGRESSION", "AMBIGUOUS", "RESTORATION", "UNCHANGED"])("uses the authoritative %s result without direct personal writes", async (classification) => {
    const commands: Row[] = [], writes: Query[] = [];
    const db = database((q) => {
      if (q.op !== "select") writes.push(q);
      return { data: q.finished ? [] : [{ id: "row", tmdb_id: 1, title: "Fixture", last_synced_at: null }], error: null };
    }, ({ command }) => {
      commands.push(command);
      return { data: { classification, accepted: classification === "GROWTH", growth: classification === "GROWTH" }, error: null };
    });
    const run = handler("watching-series-sync", db, (url) => url.includes("/season/")
      ? json({ episodes: [{ id: 10001, episode_number: 1, air_date: "2020-01-01" }] })
      : json({ id: 1, status: "Ended", seasons: [{ id: 2001, season_number: 1, episode_count: 1 }] }));
    const response = await run();
    expect(response.body.error).toBeUndefined();
    expect(response.status).toBe(["REGRESSION","AMBIGUOUS"].includes(classification) ? 500 : 200);
    expect(writes).toHaveLength(0);
    expect(commands[0].facts).toMatchObject({ seasons: [{ episodes: [{ id: 10001, number: 1, aired: true }] }] });
  });
  it("records a failed check without sending malformed facts or writing personal state", async () => {
    const commands: Row[] = [];
    const db = database((q) => ({ data: q.finished ? [] : [{ id: "row", tmdb_id: 1, title: "Fixture", last_synced_at: null }], error: null }), ({ command }) => {
      commands.push(command); return { data: { classification: "FAILED", growth: false }, error: null };
    });
    const run = handler("watching-series-sync", db, () => json({ error: "Invalid payload" }));
    expect((await run()).status).toBe(500);
    expect(commands).toHaveLength(1);
    expect(commands[0].error_code).toBe("INVALID_RESPONSE");
    expect(commands[0].facts).toBeUndefined();
  });
});


describe("Series catalogue initialization",()=>{
  const transport=(url:string)=>url.includes("/season/") ? json({episodes:[{id:101,episode_number:1,air_date:"2020-01-01",runtime:24}]}) : json({id:Number(/\/tv\/(\d+)/.exec(url)?.[1]),status:"Ended",seasons:[{id:201,season_number:1,episode_count:1}]});
  it("initializes fresh finished legacy titles missing accepted episode evidence",async()=>{
    const commands:Row[]=[];
    const db=database(q=>({data:q.table==="media_items" && q.finished ? [{id:"legacy",tmdb_id:42,title:"Ended fixture",last_synced_at:new Date().toISOString()}]:q.table==="rewatches" ? [{media_item_id:"legacy"}]:[],error:null}),({command})=>{commands.push(command);return {data:{classification:"BASELINE",accepted:true,growth:false},error:null};});
    const response=await handler("watching-series-sync",db,transport)();
    expect(response.status).toBe(200);expect(response.body.shows).toBe(1);
    expect(commands[0]).toMatchObject({work_key:"tv:42",facts:{seasons:[{episodes:[{id:101,number:1,air_date:"2020-01-01",runtime:24}]}]}});
  });
  it("keeps fresh finished titles with accepted evidence on the weekly cadence",async()=>{
    let calls=0;
    const db=database(q=>({data:q.table==="media_items" && q.finished ? [{id:"cached",tmdb_id:42,last_synced_at:new Date().toISOString()}]:q.table==="provider_heads" ? [{work_key:"tv:42",accepted_snapshot_id:"accepted",checked_at:new Date().toISOString()}]:[],error:null}));
    const response=await handler("watching-series-sync",db,async url=>{calls++;return transport(url);})();
    expect(response.body.shows).toBe(0);expect(calls).toBe(0);
  });
  it("prioritizes legacy rewatches, remains bounded and preserves room for airing shows",async()=>{
    const finished=Array.from({length:30},(_,i)=>({id:`old-${i}`,tmdb_id:100+i,title:`Ended ${i}`,last_synced_at:new Date().toISOString()}));
    const ongoing=Array.from({length:20},(_,i)=>({id:`air-${i}`,tmdb_id:200+i,title:`Airing ${i}`,last_synced_at:"2020-01-01"}));
    const works:string[]=[];
    const db=database(q=>({data:q.table==="media_items" ? q.finished ? finished:ongoing:q.table==="provider_heads" ? ongoing.map(r=>({work_key:`tv:${r.tmdb_id}`,accepted_snapshot_id:"accepted",checked_at:new Date().toISOString()})):q.table==="rewatches" ? [{media_item_id:"old-29"}]:[],error:null}),({command})=>{works.push(command.work_key);return {data:{classification:"BASELINE",accepted:true,growth:false},error:null};});
    const response=await handler("watching-series-sync",db,transport)();
    expect(response.body.shows).toBe(25);expect(works[0]).toBe("tv:129");expect(new Set(works).size).toBe(25);expect(works.filter(w=>Number(w.slice(3))>=200)).toHaveLength(12);
  });
  it("does not immediately hammer a failed initial catalogue check",async()=>{
    let calls=0;
    const db=database(q=>({data:q.table==="media_items" && q.finished ? [{id:"missing",tmdb_id:42,last_synced_at:"2020-01-01"}]:q.table==="provider_heads" ? [{work_key:"tv:42",accepted_snapshot_id:null,checked_at:new Date().toISOString()}]:[],error:null}));
    const response=await handler("watching-series-sync",db,async url=>{calls++;return transport(url);})();
    expect(response.body.shows).toBe(0);expect(calls).toBe(0);
  });
});


describe("Actual series worker absolute-numbering repair",()=>{
  it("accepts the full148-episode Hunter x Hunter catalogue with per-season local coordinates",async()=>{
    const commands:Row[]=[];const counts=[62,74,12],offsets=[0,62,136];
    const db=database(q=>({data:q.table==="media_items" && q.finished ? [{id:"hxh",tmdb_id:46298,title:"Hunter x Hunter",last_synced_at:new Date().toISOString()}]:q.table==="rewatches" ? [{media_item_id:"hxh"}]:[],error:null}),({command})=>{commands.push(command);return {data:{classification:"BASELINE",accepted:true,growth:false},error:null};});
    const run=handler("watching-series-sync",db,url=>{
      const match=/\/season\/(\d+)/.exec(url);
      if(match){const number=Number(match[1]);return json({id:200+number,season_number:number,episodes:Array.from({length:counts[number-1]},(_,i)=>({id:1000+offsets[number-1]+i,episode_number:offsets[number-1]+i+1,air_date:"2014-09-23",runtime:24}))});}
      return json({id:46298,status:"Ended",seasons:[3,1,2].map(number=>({id:200+number,season_number:number,episode_count:counts[number-1]}))});
    });
    const result=await run();expect(result.status).toBe(200);expect(result.body.failed).toBe(0);
    const facts=commands[0].facts as {seasons:{announced:number;episodes:{id:number;number:number;runtime:number}[]}[]};
    const seasons=facts.seasons;
    expect(seasons.map(s=>s.announced)).toEqual(counts);
    expect(seasons.map(s=>[s.episodes[0].number,s.episodes.at(-1)!.number])).toEqual([[1,62],[1,74],[1,12]]);
    expect(seasons.flatMap(s=>s.episodes)).toHaveLength(148);
    expect(seasons[1].episodes[0]).toMatchObject({id:1062,number:1,runtime:24});
  });
  it("retries an initial failure after ten minutes, independently of the six-hour airing cadence",async()=>{
    let calls=0;
    const db=database(q=>({data:q.table==="media_items" && q.finished ? [{id:"retry",tmdb_id:42,last_synced_at:new Date().toISOString()}]:q.table==="provider_heads" ? [{work_key:"tv:42",accepted_snapshot_id:null,checked_at:new Date(Date.now()-11*60*1000).toISOString()}]:[],error:null}));
    const result=await handler("watching-series-sync",db,async url=>{calls++;return url.includes("/season/") ? json({episodes:[{id:101,episode_number:1,air_date:"2020-01-01"}]}):json({id:42,status:"Ended",seasons:[{id:201,season_number:1,episode_count:1}]});})();
    expect(result.status).toBe(200);expect(result.body.shows).toBe(1);expect(calls).toBe(2);
  });
});
