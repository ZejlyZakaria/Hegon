import { computeStats } from "../components/stats/computeStats";
import type { StatsRawItem } from "../service";
import type { HistoryAnalytics } from "./history-analytics";
import { afterEach,describe,it,expect,vi } from "vitest";
import { completionDatePatch,watchedPeriodLabel } from "./completion-date";
import { assertion,captureHistory,viewingDate,type HistoryMetadata,type StoredViewingAssertion,type ViewingAssertion } from "./viewing-history";
import { markWatchedPatch,type StatusFacts } from "./watch-status";
import { updateMediaItem } from "../service";
import { http,HttpResponse } from "msw";
import { server } from "@/tests/mocks/server";

const id="f113dc29-35b8-45d0-b501-f007f486a958";
const before=()=>({id,type:"anime" as const,status:"ended" as const,watched:false,in_progress:true,paused:false,dropped:false,favorite:false,
  current_season:2,current_episode:50,season_episodes:[366,50],season_aired:[366,50],runtime:24,
  season_years:{"1":2020,"2":2023},caught_up_at:null,personal_revision:6,watched_at:"2023-12-31T12:00:00Z"});
const first=(override:Partial<StoredViewingAssertion>={}):StoredViewingAssertion=>({...assertion("FIRST_WATCH",viewingDate({year:2026,month:10,day:28}),[
  {season_key:"tmdb-season:2",season_number_at_recording:2,episode_from:50,episode_to:50,episode_ids:null,minutes:24,duration_basis:"RUNTIME_SNAPSHOT"}]),
  id:"last",recorded_at:"2026-10-28T12:41:14Z",...override});
afterEach(()=>{vi.useRealTimers();vi.unstubAllEnvs();});
function finish(records=[first()],meta:HistoryMetadata={history_intent:"claim"}) {
  const b=before();return completionDatePatch(b,markWatchedPatch(b as StatusFacts)!,meta,records);
}
describe("Dated final consumption outranks an old aggregate season year",()=>{
  it("reproduces Bleach then fixes the Finish command without moving season years",()=>{
    const b=before(),old=markWatchedPatch(b)!;expect(old.watched_at).toContain("2023");
    const resolved=finish();
    expect(resolved.patch).toMatchObject({watched:true,watched_at:"2026-10-28T12:00:00.000Z",season_years:{"1":2020,"2":2023}});
    const records=captureHistory(b,resolved.patch,resolved.meta,[first()]).records;
    expect(records).toHaveLength(1);expect(records[0]).toMatchObject({kind:"COMPLETION",completion_basis:"FINISHED_TITLE",year:2026,month:10,day:28,date_precision:"DAY"});
    expect(records[0].ranges.every(r=>r.minutes===0 && r.duration_basis==="MILESTONE")).toBe(true);
  });
  it("uses the last episode day even when Finish is pressed days later",()=>{
    vi.useFakeTimers();vi.setSystemTime(new Date("2026-11-04T12:00:00Z"));
    expect(finish().meta.history_date).toEqual({year:2026,month:10,day:28});
  });
  it.each([null,{year:2024,month:null,day:null}])("respects an explicit completion date %j",date=>{
    expect(finish([first()],{history_intent:"claim",history_date:date}).meta.history_date).toEqual(date);
  });
  it.each(["YEAR","MONTH"] as const)("preserves %s precision of actual terminal evidence",precision=>{
    const r=first({...viewingDate({year:2026,month:precision==="YEAR" ? null:10,day:null})});
    const resolved=finish([r]);expect(resolved.meta.history_date).toEqual({year:2026,month:r.month,day:null});
    expect(captureHistory(before(),resolved.patch,resolved.meta,[r]).records[0].date_precision).toBe(precision);
  });
  it("never dates an old undated correction from its recorded_at timestamp",()=>{
    expect(finish([first()],{history_intent:"correction"}).meta.history_date).toBeUndefined();
    expect(finish([first({...viewingDate(),date_confidence:"UNKNOWN"})]).meta.history_date).toBeUndefined();
    expect(finish([]).meta.history_date).toBeUndefined();
  });
  it("ignores rewatches, inferred dates, non-terminal episodes and partial progress",()=>{
    for(const r of [first({kind:"REWATCH"}),first({date_confidence:"INFERRED"}),first({ranges:[{...first().ranges[0],episode_from:49,episode_to:49}]})])
      expect(finish([r]).meta.history_date).toBeUndefined();
    const b={...before(),current_episode:49};
    expect(completionDatePatch(b,{watched:true,current_episode:49},{},[first()]).meta.history_date).toBeUndefined();
  });
  it("does not redate already-consumed coverage from a later duplicate first-watch record",()=>{
    const later=first({id:"duplicate",year:2027,recorded_at:"2027-01-01"});
    expect(finish([later,first()]).meta.history_date?.year).toBe(2026);
  });
  it("protects canonical completion dates when only old season years are edited",()=>{
    const b={...before(),watched:true};
    const completion=first({kind:"COMPLETION",completion_basis:"FINISHED_TITLE"});
    const resolved=completionDatePatch(b,{season_years:{"1":2019,"2":2023},watched_at:"2023-12-31"},{},[completion]);
    expect(resolved.patch.watched_at).toBe("2026-10-28T12:00:00.000Z");expect(resolved.meta.history_date).toBeUndefined();
  });
  it("keeps films and legacy claims on their existing path",()=>{
    const patch={watched:true,watched_at:"2020-01-01"};
    expect(completionDatePatch({...before(),type:"film"},patch,{},[first()]).patch).toBe(patch);
    expect(finish([]).patch.watched_at).toContain("2023");
  });
  it("shows2020-2026 while keeping both old season stamps untouched",()=>{
    expect(watchedPeriodLabel({...before(),watched:true,watched_at:"2026-10-28T12:00:00Z"},before().season_years)).toBe("2020 – 2026");
    expect(watchedPeriodLabel({...before(),watched:false},before().season_years)).toBe("2020 – 2023");
    expect(watchedPeriodLabel({type:"film",watched:true,watched_at:"2020-04-03"},{})).toBe("2020");
  });
});
describe("A finish projection cannot move legacy Activity",()=>{
  it("retains2020/2023 hours and the old stored month when global completion moves to2026",()=>{
    const item:StatsRawItem={...before(),tmdb_id:30984,title:"Bleach",watched:true,
      original_title:null,poster_url:null,backdrop_url:null,year:2004,episodes:416,user_rating:8.5,tags:[],directors:[],updated_at:"2026-10-28",
      cour_years:{},cour_ratings:{},season_ratings:{},season_posters:null,season_end_dates:null,viewing_date:{year:2026,month:10,day:28},
      legacy_consumption:{version:1,captured_at:"2026-10-22",counts:[366,49],runtime:24,fallback_year:2026,completed:false}};
    const h:HistoryAnalytics={ratings:[],records:[first({id:"49",day:20,ranges:[{...first().ranges[0],episode_from:49,episode_to:49}]}),first()].map(r=>({...r,
      work_key:"tv:30984",media_item_id:id,title_snapshot:"Bleach",media_type_snapshot:"anime",recorded_at:r.recorded_at!,retracted_at:null}))};
    const corrected={...item,watched_at:"2026-10-28T12:00:00.000Z",legacy_consumption:{...item.legacy_consumption!,calendar_date:item.watched_at}};
    for(const year of [null,2020,2023,2026]) {
      const old=computeStats([item],[],year,new Map(),h),next=computeStats([corrected],[],year,new Map(),h);
      expect(next.hours).toEqual(old.hours);expect(next.counts).toEqual(old.counts);expect(next.activity).toEqual(old.activity);
      expect(next.monthlyStats).toEqual(old.monthlyStats);
    }
    expect(computeStats([corrected],[],2023,new Map(),h).activity).toEqual([{label:"2023-12",count:1}]);
  });
});
describe("Actual service sends one atomic dated completion",()=>{
  it("projects the accepted date and forwards it to the canonical command without an empty extra viewing",async()=>{
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL","https://watching-test.supabase.co");vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY","test-anon-key");
    type Command={patch:Record<string,unknown>;records:ViewingAssertion[];expected_revision:number};
    const commands:Command[]=[];
    server.use(http.get("https://watching-test.supabase.co/rest/v1/media_items",()=>HttpResponse.json(before())),
      http.get("https://watching-test.supabase.co/rest/v1/viewing_records",()=>HttpResponse.json([first()])),
      http.post("https://watching-test.supabase.co/rest/v1/rpc/personal_history_command",async({request})=>{
        const {command}=await request.json() as {command:Command};commands.push(command);
        return HttpResponse.json({...before(),...command.patch,personal_revision:7});
      }));
    const saved=await updateMediaItem(id,{...markWatchedPatch(before()),expected_revision:6,history_intent:"claim"});
    expect(saved.watched_at).toBe("2026-10-28T12:00:00.000Z");
    expect(commands).toHaveLength(1);expect(commands[0]).toMatchObject({expected_revision:6,patch:{viewing_date:{year:2026,month:10,day:28},season_years:{"1":2020,"2":2023}},records:[{kind:"COMPLETION",day:28,month:10,year:2026}]});
    expect(commands[0].records).toHaveLength(1);
  });
});
