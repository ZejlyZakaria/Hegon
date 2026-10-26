import { afterEach, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/tests/mocks/server";
import { getPersonBundle, getWatchlistPage, getAnimeCoursMany, saveScopeRating, getHistoryAnalytics, addRewatch, getRewatches } from "./service";
import { mapCredits } from "./hooks/useMediaCredits";
afterEach(() => vi.unstubAllEnvs());
describe("Watching provider service contracts", () => {
  it("keeps movie/TV identities and multiple roles distinct in filmography", async () => {
    vi.stubEnv("TMDB_API_KEY", "test-key");
    const base = { id: 1399, poster_path: "/poster", vote_average: 8, popularity: 10 };
    server.use(http.get("https://api.themoviedb.org/3/person/1", () => HttpResponse.json({ id: 1, name: "Person", combined_credits: {
      cast: [{ ...base, media_type: "movie", title: "Film", character: "Lead", release_date: "2020-01-01" }, { ...base, media_type: "tv", name: "TV", character: "Lead", first_air_date: "2020-01-01" }],
      crew: [{ ...base, media_type: "tv", name: "TV", job: "Creator" }, { ...base, id: 2, media_type: "tv", name: "Production", job: "Executive Producer" }],
    } })));
    const { credits } = await getPersonBundle(1);
    expect(credits).toHaveLength(2);
    expect(credits.map((c) => c.type).sort()).toEqual(["film", "serie"]);
    expect(credits.find((c) => c.type === "serie")?.roles).toContainEqual({ role: "Creator", department: "Creating" });
  });
  it("keeps actual directors and TV creators with explicit roles, without a storage cap", () => {
    const crew = Array.from({ length: 5 }, (_, id) => ({ id, name: `Director ${id}`, job: "Director" }));
    const result = mapCredits({ credits: { crew: [...crew, { id: 99, name: "Producer", job: "Executive Producer" }] }, created_by: [{ id: 88, name: "Creator" }] }, "serie");
    expect(result.directors).toHaveLength(6);
    expect(result.directors.find((p) => p.id === 88)?.role).toBe("creator");
    expect(result.directors.some((p) => p.id === 99)).toBe(false);
    expect(result.directors.filter((p) => p.role === "director")).toHaveLength(5);
  });
});

describe("Watching complete collection requests", () => {
  const setup = () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://watching-test.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key");
  };
  it("reads the final watchlist priority bucket after the first 100 items", async () => {
    setup();
    const counts: Record<string, number> = { "eq.high": 10, "eq.medium": 60, "eq.low": 30, "is.null": 20 };
    server.use(http.get("https://watching-test.supabase.co/rest/v1/media_items", ({ request }) => {
      const q = new URL(request.url).searchParams;
      const count = counts[q.get("priority_level")!] ?? 0;
      expect(q.get("want_to_watch")).toBe("eq.true");
      expect(q.get("type")).toBe("eq.film");
      expect(q.get("or")).toContain("and(or(release_date.lte.");
      const from = Number(q.get("offset") ?? 0);
      const size = Number(q.get("limit") ?? count);
      const items = Array.from({ length: Math.max(0, Math.min(size, count - from)) }, (_, i) => ({ id: `item-${from + i}` }));
      return HttpResponse.json(items, { headers: { "content-range": `${from}-${from + items.length - 1}/${count}` } });
    }));
    const page = await getWatchlistPage("user", "film", { sort: "priority", level: "all", search: "Title" }, 100);
    expect(page.total).toBe(120);
    expect(page.items).toHaveLength(20);
  });
  it("loads anime overlays beyond 1000 without an oversized ID query", async () => {
    setup();
    let calls = 0;
    server.use(http.get("https://watching-test.supabase.co/rest/v1/anime_cours", ({ request }) => {
      calls++;
      const filter = new URL(request.url).searchParams.get("tmdb_id")!;
      const ids = filter.slice(4, -1).split(",").map(Number);
      expect(ids.length).toBeLessThanOrEqual(200);
      return HttpResponse.json(ids.map((tmdb_id) => ({ tmdb_id, cours: [], source: "test" })));
    }));
    const rows = await getAnimeCoursMany(Array.from({ length: 1201 }, (_, i) => i + 1));
    expect(rows.size).toBe(1201);
    expect(calls).toBe(7);
  });
});


describe("scope rating transport idempotency", () => {
  it("retries a lost transport with the identical operation and catalogue context", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://watching-test.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key");
    const requests: Record<string, unknown>[] = [];
    server.use(http.post("https://watching-test.supabase.co/rest/v1/rpc/scope_rating_command", async ({ request }) => {
      const body = await request.json() as { command: Record<string, unknown> };
      requests.push(body.command);
      return requests.length === 1 ? HttpResponse.error() : HttpResponse.json({ media: { id: "media", personal_revision: 2 } });
    }));
    await expect(saveScopeRating({ media_id: "media", expected_revision: 1, scope_kind: "SEASON", scope_number: 2,
      score: 9, action: "CONFIRM", previous_rating_id: "old", expected_scope_key: "tmdb-season:2002", expected_snapshot_id: "snapshot", expected_mapping_snapshot_id: null })).resolves.toMatchObject({ personal_revision: 2 });
    expect(requests).toHaveLength(2);
    expect(requests[0]).toEqual(requests[1]);
    expect(requests[0].operation_key).toMatch(/^[0-9a-f-]{36}$/);
    expect(requests[0].expected_snapshot_id).toBe("snapshot");
  });
});

describe("Wave2C canonical service boundaries",()=>{
  const setup=()=>{vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL","https://watching-test.supabase.co");vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY","test-anon-key");};
  it("pages records/ranges/ratings past1000 with owner filters and no per-record calls",async()=>{
    setup();const calls:Record<string,number>={};
    for (const table of ["viewing_records","viewing_ranges","scope_ratings"]) server.use(http.get(`https://watching-test.supabase.co/rest/v1/${table}`,({request})=>{
      const q=new URL(request.url).searchParams;expect(q.get(table==="viewing_ranges" ? "record.user_id" : "user_id")).toBe("eq.owner");
      expect(q.get(table==="viewing_ranges" ? "record.org_id" : "org_id")).toBe("eq.org");
      const offset=Number(q.get("offset") ?? 0),limit=Number(q.get("limit") ?? 1000);calls[table]=(calls[table] ?? 0)+1;
      const rows=Array.from({length:Math.max(0,Math.min(limit,1105-offset))},(_,i)=>({id:String(offset+i),viewing_record_id:String(offset+i)}));
      return HttpResponse.json(rows);
    }));
    const result=await getHistoryAnalytics("owner","org");expect(result.records).toHaveLength(1105);expect(result.ratings).toHaveLength(1105);expect(result.records[1104].ranges).toHaveLength(1);
    expect(Object.values(calls)).toEqual([2,2,2]);
  });
  it("reads only rewatch history, hides compatibility duplicates and preserves legacy uncertainty",async()=>{
    setup();server.use(http.get("https://watching-test.supabase.co/rest/v1/viewing_ranges",()=>HttpResponse.json([])),http.get("https://watching-test.supabase.co/rest/v1/rewatches",()=>HttpResponse.json([
      {id:"new",watched_on:"2026-01-01",created_at:"2026-10-18"},{id:"removed",watched_on:"2026-01-01",created_at:"2026-10-18"},{id:"legacy",watched_on:"2022-01-01",created_at:"2022-01-01"},
    ])),http.get("https://watching-test.supabase.co/rest/v1/viewing_records",({request})=>{
      const q=new URL(request.url).searchParams;expect(q.get("kind")).toBe("eq.REWATCH");expect(q.get("media_item_id")).toBe("eq.movie");
      return HttpResponse.json([{id:"new",kind:"REWATCH",scope_kind:"WHOLE_TITLE",year:2026,month:null,day:null,date_precision:"YEAR",retracted_at:null,recorded_at:"2026-10-18"},
        {id:"removed",kind:"REWATCH",scope_kind:"UNKNOWN",retracted_at:"2026-10-18"}]);
    }));
    const rows=await getRewatches("movie");expect(rows).toHaveLength(2);expect(rows[0].watched_on).toBe("2026");expect(rows[1]).toMatchObject({id:"legacy",watched_on:"2022-01-01",scope_known:false,canonical:false});
  });
  it("records an explicit whole-film scope and retries the same frozen operation",async()=>{
    setup();const requests:Record<string,unknown>[]=[];
    server.use(http.get("https://watching-test.supabase.co/rest/v1/media_items",()=>HttpResponse.json({id:"movie",type:"film",runtime:120,season_aired:null,personal_revision:4})),
      http.post("https://watching-test.supabase.co/rest/v1/rpc/personal_history_command",async({request})=>{
        const body=await request.json() as {command:Record<string,unknown>};requests.push(body.command);
        return requests.length===1 ? HttpResponse.error():HttpResponse.json({id:"movie",personal_revision:5});
      }));
    await expect(addRewatch("movie",{date:{year:2026,month:10,day:18},scope:{kind:"WHOLE_TITLE"}},4)).resolves.toMatchObject({personal_revision:5});
    expect(requests).toHaveLength(2);expect(requests[0]).toEqual(requests[1]);expect(requests[0].records).toMatchObject([{kind:"REWATCH",scope_kind:"WHOLE_TITLE",date_precision:"DAY",ranges:[{minutes:120}]}]);
  });
});


describe("Wave2C ambiguous cour write boundary",()=>{
  it("rejects guessed cour membership before sending a personal command",async()=>{
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL","https://watching-test.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY","test-anon-key");
    let writes=0;
    server.use(http.get("https://watching-test.supabase.co/rest/v1/media_items",()=>HttpResponse.json({id:"anime",type:"anime",tmdb_id:42,runtime:24,season_episodes:[24,12],season_aired:[12,12],personal_revision:4})),
      http.post("https://watching-test.supabase.co/rest/v1/rpc/personal_history_command",()=>{writes++;return HttpResponse.json({});}));
    await expect(addRewatch("anime",{date:null,scope:{kind:"COUR",number:1,courId:501}},4,
      {snapshot_id:null,mapping_snapshot_id:null,seasons:[],cours:[{id:501,number:1,start:13,end:24}]})).rejects.toThrow("Refresh season details before recording this rewatch");
    expect(writes).toBe(0);
  });
});


describe("Rewatch period and legacy correction commands",()=>{
  it("freezes accepted per-episode durations and historical membership without browser cache",async()=>{
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL","https://watching-test.supabase.co");vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY","test-anon-key");
    let saved:Record<string,unknown>|undefined;
    server.use(http.get("https://watching-test.supabase.co/rest/v1/media_items",()=>HttpResponse.json({id:"tv",tmdb_id:42,type:"serie",runtime:999,season_aired:[2,1],personal_revision:4})),
      http.post("https://watching-test.supabase.co/rest/v1/rpc/personal_history_command",async({request})=>{saved=(await request.json() as {command:Record<string,unknown>}).command;return HttpResponse.json({id:"tv",personal_revision:5});}));
    const catalogue={snapshot_id:"accepted",mapping_snapshot_id:null,cours:[],seasons:[
      {id:201,number:1,announced:2,aired:2,episodes:[{id:101,number:1,aired:true,air_date:"2021-01-01",runtime:23},{id:102,number:2,aired:true,air_date:"2022-01-01",runtime:25}]},
      {id:202,number:2,announced:1,aired:1,episodes:[{id:201,number:1,aired:true,air_date:"2026-01-01",runtime:30}]},
    ]};
    await addRewatch("tv",{date:{year:2022,month:null,day:null},scope:{kind:"WHOLE_TITLE"}},4,catalogue);
    expect(saved).toMatchObject({patch:{},viewing_context:{snapshot_id:"accepted",mapping_snapshot_id:null},records:[{date_precision:"YEAR",scope_kind:"WHOLE_TITLE",ranges:[{episode_ids:[101,102],minutes:48}]}]});
  });
  it("completes a legacy event using one transactional replacement command",async()=>{
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL","https://watching-test.supabase.co");vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY","test-anon-key");
    let saved:Record<string,unknown>|undefined;
    server.use(http.get("https://watching-test.supabase.co/rest/v1/media_items",()=>HttpResponse.json({id:"movie",type:"film",runtime:169,personal_revision:4})),
      http.post("https://watching-test.supabase.co/rest/v1/rpc/personal_history_command",async({request})=>{saved=(await request.json() as {command:Record<string,unknown>}).command;return HttpResponse.json({id:"movie",personal_revision:5});}));
    await addRewatch("movie",{date:{year:2022,month:3,day:1},scope:{kind:"WHOLE_TITLE"},legacyId:"legacy"},4);
    expect(saved).toMatchObject({mode:"remove_rewatch",rewatch_id:"legacy",patch:{},retract_ids:[],records:[{kind:"REWATCH",origin:"USER_CORRECTION",ranges:[{minutes:169}]}]});
  });
});
