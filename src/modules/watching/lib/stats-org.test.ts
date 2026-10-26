import { beforeEach,afterEach,describe,it,expect,vi } from "vitest";
import { http,HttpResponse } from "msw";
import { server } from "@/tests/mocks/server";
import { QueryClient } from "@tanstack/react-query";
import { useWatchingStatsData } from "../hooks/useWatchingStats";
import { useAchievementReceipts } from "../hooks/useAchievementReceipts";
import { WATCHING_KEYS } from "../hooks/query-keys";
import { getWatchingStatsData,getRewatchStats } from "../service";
import { receiptMetrics } from "./milestone-receipts";
import { computeStats } from "../components/stats/computeStats";
import { assertion,viewingDate } from "./viewing-history";

vi.mock("react",async()=>({...await vi.importActual<typeof import("react")>("react"),useMemo:(fn:()=>unknown)=>fn()}));

type Options={queryKey:readonly unknown[];queryFn:()=>Promise<unknown>;enabled:boolean};
const state=vi.hoisted(()=>({orgId:"A" as string|null,queries:[] as Options[],observe:vi.fn(),results:{} as Record<string,Record<string,unknown>>}));
vi.mock("@/shared/stores/useOrgStore",()=>({useOrgStore:(select:(s:{orgId:string|null})=>unknown)=>select(state)}));
vi.mock("@tanstack/react-query",async()=>({...await vi.importActual<typeof import("@tanstack/react-query")>("@tanstack/react-query"),useQuery:(options:Options)=>{state.queries.push(options);return state.results[options.queryKey.at(-1)==="observation" ? "observation":"existing"] ?? {};}}));
vi.mock("../receipt-actions",()=>({observeWatchingAchievements:state.observe}));
type Inputs=Awaited<ReturnType<typeof getWatchingStatsData>> & {rewatches:Awaited<ReturnType<typeof getRewatchStats>>};
const requests:{table:string;org:string}[]=[];
const media=(org:string,id:number,minutes:number,user="owner")=>({id:`item${id}`,tmdb_id:id,org_id:org,user_id:user,type:"film",title:`Film${id}`,watched:true,runtime:minutes,watched_at:"2026-04-01",viewing_date:null,season_aired:null,season_episodes:null});
const rows=[media("A",1,6000),media("B",2,180000),media("A",3,999999,"someone-else")];
const records=rows.map(m=>({...assertion("FIRST_WATCH",viewingDate({year:2026,month:4,day:1}),[
  {season_key:"movie",season_number_at_recording:0,episode_from:1,episode_to:1,episode_ids:null,minutes:m.runtime,duration_basis:"RUNTIME_SNAPSHOT"}]),
  id:`record${m.tmdb_id}`,work_key:`movie:${m.tmdb_id}`,media_item_id:m.id,org_id:m.org_id,user_id:m.user_id,title_snapshot:m.title,media_type_snapshot:"film",recorded_at:"2026-04-01",retracted_at:null}));
beforeEach(()=>{
  state.orgId="A";state.queries=[];state.results={};state.observe.mockReset();requests.length=0;
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL","https://watching-test.supabase.co");vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY","test-anon-key");
  for(const table of ["media_items","viewing_records","viewing_ranges","scope_ratings","rewatches"])server.use(http.get(`https://watching-test.supabase.co/rest/v1/${table}`,({request})=>{
    const q=new URL(request.url).searchParams,nested=table==="viewing_ranges",org=q.get(nested ? "record.org_id":"org_id");
    expect(q.get(nested ? "record.user_id":"user_id")).toBe("eq.owner");expect(org).toMatch(/^eq.[AB]$/);
    requests.push({table,org:org!.slice(3)});
    const selected=rows.filter(m=>`eq.${m.org_id}`===org && m.user_id==="owner");
    if(table==="media_items")return HttpResponse.json(selected);
    const history=records.filter(r=>selected.some(m=>m.id===r.media_item_id));
    if(table==="viewing_records")return HttpResponse.json(history);
    if(table==="viewing_ranges")return HttpResponse.json(history.flatMap(r=>r.ranges.map(v=>({...v,id:r.id,viewing_record_id:r.id}))));
    if(table==="rewatches")return HttpResponse.json(selected.map(m=>({id:`rewatch${m.id}`,media_item_id:m.id,watched_on:"2026-05-01"})));
    return HttpResponse.json([]);
  }));
});
afterEach(()=>vi.unstubAllEnvs());
function useStatsOptions(){useWatchingStatsData("owner");return state.queries.at(-1)!;}
describe("Organization scope shared by Stats, its cache and receipt observations",()=>{
  it("keeps both organizations' HTTP reads and cached totals separate for the same owner",async()=>{
    const cache=new QueryClient({defaultOptions:{queries:{retry:false}}});
    try {
      const a=useStatsOptions();state.orgId="B";const b=useStatsOptions();
      expect(a.queryKey).not.toEqual(b.queryKey);
      // Execute A after the switch: the request must retain the organization in A's cache key.
      const dataA=await cache.fetchQuery(a) as Inputs,dataB=await cache.fetchQuery(b) as Inputs;
      for(const [org,data,expected] of [["A",dataA,100],["B",dataB,3000]] as const){
        const stats=computeStats(data.items,data.rewatches,null,data.cours,data.history);
        const observed=receiptMetrics({...data,cours:[...data.cours.values()],source_hash:"fixture",measured_at:"2026-10-21"});
        expect(stats.hours.total).toBe(expected);
        expect(observed.achievements.find(a=>a.achievement_key==="marathoner")?.actual_value).toBe(expected);
        expect(data.items).toHaveLength(1);expect(data.history.records).toHaveLength(1);expect(data.rewatches).toHaveLength(1);
        expect(cache.getQueryData(WATCHING_KEYS.stats("owner",org))).toBe(data);
        expect(requests.filter(r=>r.org===org).map(r=>r.table).sort()).toEqual(["media_items","rewatches","scope_ratings","viewing_ranges","viewing_records"]);
      }
    } finally {cache.clear();}
  });
  it("retains stable local work identity in the actual service after deletion",async()=>{
    const local={...records[0],work_key:"local:deleted",media_item_id:null};
    server.use(http.get("https://watching-test.supabase.co/rest/v1/media_items",()=>HttpResponse.json([])),
      http.get("https://watching-test.supabase.co/rest/v1/viewing_records",()=>HttpResponse.json([local])),
      http.get("https://watching-test.supabase.co/rest/v1/viewing_ranges",()=>HttpResponse.json(local.ranges.map(v=>({...v,id:"range",viewing_record_id:local.id})))));
    const data=await getWatchingStatsData("owner","A"),rewatches=await getRewatchStats("owner","A");
    expect(computeStats(data.items,rewatches,null,data.cours,data.history).hours.total).toBe(100);
    expect(receiptMetrics({...data,rewatches,cours:[...data.cours.values()],source_hash:"fixture",measured_at:"2026-10-21"}).goalValue("films",null)).toBe(1);
  });
  it("shows a saved Marathoner receipt while observation is pending or fails",async()=>{
    const receipt={achievement_key:"marathoner",actual_value:3331,target:3000,observed_at:"2026-10-21",rule_version:1};
    server.use(http.get("https://watching-test.supabase.co/rest/v1/achievement_unlocks",({request})=>{
      const q=new URL(request.url).searchParams;
      expect(q.get("user_id")).toBe("eq.owner");expect(q.get("org_id")).toBe("eq.A");
      expect(q.get("select")).not.toBe("*");
      return HttpResponse.json([receipt]);
    }));
    useAchievementReceipts("owner");
    const read=state.queries.at(-2)!,observation=state.queries.at(-1)!;
    expect(observation.enabled).toBe(false);expect(state.observe).not.toHaveBeenCalled();
    state.results.existing={isSuccess:true,data:await read.queryFn()};
    const fast=useAchievementReceipts("owner");
    expect(fast.data.receipts).toEqual([receipt]);expect(state.queries.at(-1)!.enabled).toBe(true);
    let finish!:(value:{receipts:unknown[]})=>void;
    state.observe.mockReturnValue(new Promise(resolve=>{finish=resolve;}));
    const pending=state.queries.at(-1)!.queryFn();
    expect(useAchievementReceipts("owner").data.receipts).toEqual([receipt]);
    state.results.observation={error:new Error("Observation failed")};
    const failed=useAchievementReceipts("owner");
    expect(failed.data.receipts).toEqual([receipt]);expect(failed.error?.message).toBe("Observation failed");
    finish({receipts:[]});await pending;
    // An older cached empty observation also cannot erase the saved receipt.
    state.results.observation={data:{receipts:[]}};
    expect(useAchievementReceipts("owner").data.receipts).toEqual([receipt]);
  });
  it("binds receipt calls to their cache organization and waits when no organization is selected",async()=>{
    useAchievementReceipts("owner");const a=state.queries.at(-1)!;
    state.orgId="B";useAchievementReceipts("owner");const b=state.queries.at(-1)!;
    await a.queryFn();await b.queryFn();expect(state.observe.mock.calls).toEqual([["A"],["B"]]);
    expect(a.queryKey).not.toEqual(b.queryKey);
    state.orgId=null;const empty=useStatsOptions();useAchievementReceipts("owner");const noReceipt=state.queries.at(-1)!;
    expect(empty.enabled).toBe(false);expect(noReceipt.enabled).toBe(false);
    await expect(empty.queryFn()).rejects.toThrow("Organization required");
    await expect(noReceipt.queryFn()).rejects.toThrow("Organization required");
    expect(state.observe).toHaveBeenCalledTimes(2);
  });
});
