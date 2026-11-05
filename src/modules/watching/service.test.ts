import { afterEach, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/tests/mocks/server";
import { getWatchingUpdatesData, getMediaItems, updateMediaItem, getMediaHistory, getPersonBundle, getWatchlistPage, getAnimeCoursMany, saveScopeRating, getHistoryAnalytics, addRewatch, getRewatches } from "./service";
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


describe("transactional backwards correction transport",()=>{
  it("passes the explicit correction intent to the existing RPC without inventing retractions",async()=>{
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL","https://watching-test.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY","test-anon-key");
    let sent:Record<string,unknown>|undefined;
    server.use(
      http.get("https://watching-test.supabase.co/rest/v1/media_items",()=>HttpResponse.json({id:"show",type:"anime",personal_revision:4,current_season:3,current_episode:12,season_aired:[12,12,12],watched:false})),
      http.get("https://watching-test.supabase.co/rest/v1/viewing_records",()=>HttpResponse.json([],{headers:{"content-range":"*/0"}})),
      http.post("https://watching-test.supabase.co/rest/v1/rpc/personal_history_command",async({request})=>{
        sent=(await request.json() as {command:Record<string,unknown>}).command;
        return HttpResponse.json({id:"show",current_season:2,current_episode:12,season_years:{},season_ratings:{}});
      }),
    );
    const saved=await updateMediaItem("show",{current_season:2,current_episode:12,caught_up_at:null,expected_revision:4,history_intent:"correction"});
    expect(sent).toMatchObject({mode:"update",history_intent:"correction",expected_revision:4,patch:{current_season:2,current_episode:12},records:[],retract_ids:[]});
    expect((sent?.patch as Record<string,unknown>).history_intent).toBeUndefined();
    expect(saved.season_ratings).toEqual({});
  });
});

it("loads viewing history without the unused rating audit query",async()=>{
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL","https://watching-test.supabase.co");vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY","test-anon-key");
  let records=0,ranges=0,ratings=0;
  server.use(http.get("https://watching-test.supabase.co/rest/v1/viewing_records",()=>{records++;return HttpResponse.json([]);}),
    http.get("https://watching-test.supabase.co/rest/v1/viewing_ranges",()=>{ranges++;return HttpResponse.json([]);}),
    http.get("https://watching-test.supabase.co/rest/v1/scope_ratings",()=>{ratings++;return HttpResponse.json([]);}));
  expect(await getMediaHistory("title")).toEqual({records:[]});expect({records,ranges,ratings}).toEqual({records:1,ranges:1,ratings:0});
});


describe("derived series rails", () => {
  it("ranks a newly caught-up Silo ahead of ten newer first watches despite its legacy date", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://watching-test.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key");
    const base = {type:"serie",in_progress:true,watched:false,status:"ongoing",current_season:3,current_episode:10,season_aired:[10,10,10,0],season_episodes:[10,10,10,1]};
    const silo = {...base,id:"silo",watched_at:"2024-12-31 12:00:00",last_watched_at:"2026-11-04T14:57:15.578Z",caught_up_at:"2026-11-04T14:57:15.578Z"};
    const rows = [...Array.from({length:10},(_,i)=>({...base,id:`older-${i}`,watched_at:"2026-10-01",updated_at:"2026-12-01"})),silo,
      {...base,id:"invalid-first-date",watched_at:"invalid",last_watched_at:"2026-11-03",caught_up_at:null},
      {...base,id:"caught-stamp",watched_at:null,last_watched_at:null,caught_up_at:"2026-11-02"},
      {...base,id:"hill-house",watched_at:"2024-01-17",last_watched_at:null,caught_up_at:"2026-07-24",status:"ended"}];
    server.use(http.get("https://watching-test.supabase.co/rest/v1/media_items",()=>HttpResponse.json(rows)));
    const last = await getMediaItems("owner","serie",{recentlyWatched:true,limit:10});
    expect(last.map(m=>m.id).slice(0,3)).toEqual(["silo","invalid-first-date","older-0"]);
    expect(last.some(m=>["caught-stamp","hill-house"].includes(m.id))).toBe(false);
    expect(await getMediaItems("owner","serie",{inProgress:true})).toEqual([]);
  });
  it("classifies all pages before the ten-item cap and reads no provider or write endpoint", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://watching-test.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key");
    const base = { type: "serie", in_progress: true, watched: false, status: "ended",
      current_season: 1, current_episode: 6, season_aired: [6], season_episodes: [6], watched_at: "2026-04-06" };
    const rows = [
      ...Array.from({ length: 1000 }, (_, i) => ({ ...base, id: `watching-${i}`, current_episode: 2 })),
      { ...base, id: "knight" },
      { ...base, id: "waiting", status: "returning series", watched_at: "2026-03-01" },
      { ...base, id: "weekly", status: "returning series", season_episodes: [8] },
      { ...base, id: "paused", paused: true },
    ];
    let calls = 0;
    server.use(http.get("https://watching-test.supabase.co/rest/v1/media_items", ({ request }) => {
      calls++;
      const q = new URL(request.url).searchParams;
      expect(q.get("user_id")).toBe("eq.owner");
      expect(q.get("or")).toBe("(watched.eq.true,in_progress.eq.true,resume_required.eq.true)");
      expect(q.has("watched")).toBe(false);
      expect(q.get("select")).toContain("updated_at");
      const from = Number(q.get("offset") ?? 0), limit = Number(q.get("limit") ?? 1000);
      return HttpResponse.json(rows.slice(from, from + limit));
    }));
    const last = await getMediaItems("owner", "serie", { recentlyWatched: true, limit: 10 });
    expect(last.map((m) => m.id)).toEqual(["knight", "waiting"]);
    const active = await getMediaItems("owner", "serie", { inProgress: true, limit: 2000 });
    expect(active).toHaveLength(1001);
    expect(active.some((m) => m.id === "weekly")).toBe(true);
    expect(active.some((m) => ["knight", "waiting", "paused"].includes(m.id))).toBe(false);
    expect(calls).toBe(4);
  });
});


it("keeps ranked titles visible independently of favorite", async () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL","https://watching-test.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY","test-anon-key");
  server.use(http.get("https://watching-test.supabase.co/rest/v1/media_items",({request})=>{
    const query=new URL(request.url).searchParams;
    expect(query.has("favorite")).toBe(false);
    expect(query.get("priority")).toBe("not.is.null");
    return HttpResponse.json([{id:"ranked",priority:3,favorite:false}]);
  }));
  expect(await getMediaItems("owner","anime",{topRated:true})).toMatchObject([{id:"ranked",priority:3,favorite:false}]);
});


it.each(["paused","dropped"] as const)("preserves %s and its reason at the service/RPC boundary",async stance=>{
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL","https://watching-test.supabase.co");vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY","test-anon-key");
  let sent:Record<string,unknown>|undefined;
  const before={id:"show",type:"anime",personal_revision:4,current_season:2,current_episode:4,season_aired:[5,5],season_episodes:[5,5],watched:false,in_progress:false,paused:stance === "paused",dropped:stance === "dropped",drop_reason:stance === "dropped" ? "lost_interest":null};
  server.use(http.get("https://watching-test.supabase.co/rest/v1/media_items",()=>HttpResponse.json(before)),
    http.get("https://watching-test.supabase.co/rest/v1/viewing_records",()=>HttpResponse.json([],{headers:{"content-range":"*/0"}})),
    http.post("https://watching-test.supabase.co/rest/v1/rpc/personal_history_command",async({request})=>{sent=(await request.json() as {command:Record<string,unknown>}).command;return HttpResponse.json({...before,current_episode:5});}));
  await updateMediaItem("show",{current_episode:5,caught_up_at:null,watched:true,in_progress:false,paused:false,dropped:false,drop_reason:null,watched_at:"2026-11-02",history_intent:"correction",expected_revision:4});
  expect(sent?.patch).toMatchObject({current_episode:5,watched:false,in_progress:false,paused:before.paused,dropped:before.dropped,drop_reason:before.drop_reason});
  expect(sent?.patch).not.toHaveProperty("watched_at");
  expect((sent?.records as {kind:string;year:number|null}[]).every(r=>r.kind!=="COMPLETION" && r.year===null)).toBe(true);
});


it("does not let a thin catalogue refresh bypass the accepted provider transaction",async()=>{
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL","https://watching-test.supabase.co");vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY","test-anon-key");
  const saved={id:"show",type:"serie",season_aired:[10],season_episodes:[10],status:"ongoing"};
  server.use(http.get("https://watching-test.supabase.co/rest/v1/media_items",()=>HttpResponse.json(saved)),
    http.patch("https://watching-test.supabase.co/rest/v1/media_items",()=>{throw Error("Unaccepted catalogue overwrite");}));
  expect(await updateMediaItem("show",{season_aired:[10,1],season_episodes:[10,8],status:"ended"})).toEqual(saved);
});


it("does not promote a completed 2022 anime into the recent ten using an old 2026 position stamp", async () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://watching-test.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key");
  const base={type:"anime",watched:true,in_progress:false,status:"ended",current_season:2,current_episode:11,season_aired:[12,11],season_episodes:[12,11]};
  const promised={...base,id:"promised",title:"The Promised Neverland",watched_at:"2022-05-23 12:00:00",last_watched_at:"2026-09-19 14:43:25.894+00",caught_up_at:"2026-09-19 14:43:25.894+00",season_years:{1:2020,2:2022}};
  const rows=[promised,...Array.from({length:10},(_,i)=>({...base,id:`recent-${i}`,watched_at:"2026-08-01",last_watched_at:null}))];
  let reads=0;
  server.use(http.get("https://watching-test.supabase.co/rest/v1/media_items",()=>{reads++;return HttpResponse.json(rows);}));
  const recent=await getMediaItems("owner","anime",{recentlyWatched:true,limit:10});
  expect(recent).toHaveLength(10);
  expect(recent.some(m=>m.id==="promised")).toBe(false);
  const all=await getMediaItems("owner","anime",{recentlyWatched:true,limit:20});
  expect(all.at(-1)).toMatchObject(promised);
  expect(reads).toBe(2); // Same batch read per rail; no per-title history calls.
});


it("loads Updates with scoped, paginated batch reads and only accepted catalogue heads", async () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://watching-test.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key");
  const calls:string[]=[];
  server.use(http.get("https://watching-test.supabase.co/rest/v1/:table", ({request,params})=>{
    const q=new URL(request.url).searchParams; calls.push(String(params.table));
    expect(request.method).toBe("GET");
    if(params.table==="media_items") {
      expect(q.get("user_id")).toBe("eq.owner");expect(q.get("org_id")).toBe("eq.org");
      expect(q.get("type")).toBe("in.(serie,anime)");expect(q.get("limit")).toBe("1000");
      expect(q.get("or")).toContain("want_to_watch.eq.true");expect(q.get("select")).toContain("backdrop_url");
      return HttpResponse.json([{id:"show",type:"anime",tmdb_id:42,in_progress:true,current_season:1,current_episode:12,season_episodes:[24],season_aired:[12]}]);
    }
    if(params.table==="anime_cours")return HttpResponse.json([{tmdb_id:42,source:"anilist",cours:[
      {anilist_id:1,season:1,episodes:12,start_episode:1,end_episode:12},
      {anilist_id:2,season:2,episodes:12,start_episode:13,end_episode:24}]}]);
    if(params.table==="provider_heads") {expect(q.get("provider")).toBe("eq.tmdb");return HttpResponse.json([{accepted_snapshot_id:"accepted"},{accepted_snapshot_id:null}]);}
    if(params.table==="provider_snapshots") {expect(q.get("id")).toBe("in.(accepted)");return HttpResponse.json([{work_key:"tv:42",facts:{seasons:[]}}]);}
    return HttpResponse.json({message:"Unexpected read"},{status:500});
  }));
  const data=await getWatchingUpdatesData("owner","org");
  expect(data.items).toHaveLength(1);expect(data.catalogues).toHaveLength(1);expect(data.cours).toHaveLength(1);
  expect(calls.sort()).toEqual(["anime_cours","media_items","provider_heads","provider_snapshots"]);
});


it("Updates reads accepted TV episode evidence in a batch for release freshness", async () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://watching-test.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key");
  let reads=0;
  server.use(http.get("https://watching-test.supabase.co/rest/v1/media_items",()=>{
    reads++;return HttpResponse.json([{id:"show",type:"serie",tmdb_id:42,in_progress:true,current_season:1,current_episode:10,season_episodes:[10,8],season_aired:[10,0],season_air_dates:[null,"2027-01-01"]}]);
  }));
  server.use(http.get("https://watching-test.supabase.co/rest/v1/provider_heads", ({request}) => {
    reads++;expect(new URL(request.url).searchParams.get("work_key")).toBe("in.(tv:42)");return HttpResponse.json([{accepted_snapshot_id:"tv-accepted"}]);
  }),http.get("https://watching-test.supabase.co/rest/v1/provider_snapshots", () => {
    reads++;return HttpResponse.json([{work_key:"tv:42",facts:{seasons:[]}}]);
  }));
  const data=await getWatchingUpdatesData("owner","org");
  expect(data.items).toHaveLength(1);expect(data.catalogues).toHaveLength(1);expect(data.cours).toEqual([]);expect(reads).toBe(3);
});
