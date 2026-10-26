import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildRewatch, emptyCatalogue, rewatchCutoff, type RewatchCatalogue } from "./rewatch";
import { frozenMinutes, rangeCount } from "./history-analytics";
import { computeStats } from "../components/stats/computeStats";
import type { StatsRawItem } from "../service";

const media={type:"serie",runtime:999,season_aired:[3,2]};
function catalogue():RewatchCatalogue {
  return {...emptyCatalogue(),snapshot_id:"accepted",seasons:[
    {id:201,number:1,announced:3,aired:3,episodes:["2021-10-01","2022-01-04","2022-08-12"].map((air_date,i)=>({id:101+i,number:i+1,air_date,aired:true,runtime:20+i}))},
    {id:202,number:2,announced:2,aired:1,episodes:[{id:201,number:1,air_date:"2026-10-20",aired:true,runtime:24},{id:202,number:2,air_date:"2026-11-01",aired:false,runtime:25}]},
  ],cours:[{id:501,number:1,start:1,end:2},{id:502,number:2,start:3,end:5}]};
}
beforeEach(()=>vi.useFakeTimers().setSystemTime(new Date("2026-10-21T12:00:00Z")));
afterEach(()=>vi.useRealTimers());
describe("Rewatch coverage frozen at the selected period",()=>{
  it.each([
    [{year:2021,month:null,day:null},1],
    [{year:2022,month:1,day:null},2],
    [{year:2022,month:8,day:11},2],
    [{year:2022,month:8,day:12},3],
    [{year:2026,month:10,day:19},3],
    [{year:2026,month:10,day:20},4],
    [{year:2026,month:null,day:null},4],
    [null,4],
  ] as const)("includes only available membership for %j",(date,count)=>{
    const result=buildRewatch(media,{date,scope:{kind:"WHOLE_TITLE"}},catalogue());
    expect(rangeCount(result.ranges)).toBe(count);
    expect(result.date_precision).toBe(!date ? "UNKNOWN":date.month==null ? "YEAR":date.day==null ? "MONTH":"DAY");
    expect(result.ranges.flatMap(r=>r.episode_ids ?? [])).not.toContain(202);
  });
  it("preserves recorded IDs, episode counts and duration after seasons/runtimes change",()=>{
    const c=catalogue(),r=buildRewatch(media,{date:{year:2022,month:null,day:null},scope:{kind:"WHOLE_TITLE"}},c);
    const frozen=JSON.stringify(r);
    c.seasons[0].episodes[0].runtime=999;c.seasons[0].episodes[0].id=999;
    c.seasons.push({...c.seasons[0],number:3,id:203});
    expect(JSON.stringify(r)).toBe(frozen);expect(frozenMinutes(r.ranges)).toBe(63);expect(rangeCount(r.ranges)).toBe(3);
  });
  it("keeps annual and all-time rewatch hours unchanged through actual Stats after provider growth",()=>{
    const r=buildRewatch({...media,type:"anime"},{date:{year:2022,month:null,day:null},scope:{kind:"COUR",number:1,courId:501}},catalogue());
    const history={records:[{...r,id:"rewatch",media_item_id:"item",work_key:"tv:42",title_snapshot:"Anime",media_type_snapshot:"anime",recorded_at:"2026-10-21",retracted_at:null}],ratings:[]};
    const base={id:"item",tmdb_id:42,type:"anime",title:"Anime",watched:false,in_progress:false,paused:false,dropped:false,runtime:24,season_aired:[5],season_episodes:[6]} as StatsRawItem;
    const before=computeStats([base],[],2022,new Map(),history);
    const after=computeStats([{...base,runtime:999,season_aired:[170,13],season_episodes:[170,24]}],[],2022,new Map(),history);
    expect(before.hours.rewatches).toBe(41/60);expect(after.hours.rewatches).toBe(before.hours.rewatches);
    expect(after.episodes).toBe(2);expect(after.rewatches).toBe(1);
    expect(computeStats([base],[],null,new Map(),history).hours.rewatches).toBe(after.hours.rewatches);
  });
  it("accepts multiple selected seasons as ONE frozen rewatch event",()=>{
    const r=buildRewatch(media,{date:null,scope:{kind:"SEASON",selections:[{number:1},{number:2}]}},catalogue());
    expect(r.kind).toBe("REWATCH");expect(r.scope_kind).toBe("EPISODES");expect(rangeCount(r.ranges)).toBe(4);expect(frozenMinutes(r.ranges)).toBe(87);
  });
  it("rejects selecting a season not yet released at that date",()=>{
    expect(()=>buildRewatch(media,{date:{year:2022,month:null,day:null},scope:{kind:"SEASON",number:2}},catalogue())).toThrow("No known available coverage");
  });
  it("maps displayed anime seasons through announced storage offsets, including a partially aired cour",()=>{
    const c=catalogue();
    const r=buildRewatch({...media,type:"anime"},{date:{year:2026,month:10,day:20},scope:{kind:"COUR",selections:[{number:2,courId:502}]}},c);
    expect(r.scope_key).toBe("anilist-cour:502");expect(r.ranges.map(r=>[r.season_number_at_recording,r.episode_from,r.episode_to])).toEqual([[1,3,3],[2,1,1]]);
    expect(frozenMinutes(r.ranges)).toBe(46);
    c.cours[1].start=1;c.cours[1].number=1;
    expect(rangeCount(r.ranges)).toBe(2);
  });
  it("freezes an ongoing cour without an announced ending",()=>{
    const c=catalogue();c.cours[1].end=null;
    expect(rangeCount(buildRewatch({...media,type:"anime"},{date:null,scope:{kind:"COUR",number:2,courId:502}},c).ranges)).toBe(2);
  });
  it("rejects stale cour identity, overlapping selections and empty selections",()=>{
    expect(()=>buildRewatch(media,{date:null,scope:{kind:"COUR",number:2,courId:999}},catalogue())).toThrow();
    expect(()=>buildRewatch(media,{date:null,scope:{kind:"SEASON",selections:[]}},catalogue())).toThrow();
    expect(()=>buildRewatch(media,{date:null,scope:{kind:"SEASON",selections:[{number:1},{number:1}]}},catalogue())).toThrow();
    const c=catalogue();c.cours[1].start=2;
    expect(()=>buildRewatch(media,{date:null,scope:{kind:"COUR",selections:[{number:1,courId:501},{number:2,courId:502}]}},c)).toThrow("overlap");
  });
  it("retains known runtime subtotals without inventing median TV duration",()=>{
    const c=catalogue();c.seasons[0].episodes[1].runtime=null;
    const r=buildRewatch(media,{date:{year:2022,month:null,day:null},scope:{kind:"WHOLE_TITLE"}},c);
    expect(r.ranges.map(r=>r.minutes)).toEqual([20,null,22]);expect(frozenMinutes(r.ranges)).toBeNull();
  });
  it("rejects historical scope without dated membership, but allows an explicit unsure event",()=>{
    const date={year:2022,month:null,day:null};
    expect(()=>buildRewatch(media,{date,scope:{kind:"WHOLE_TITLE"}},emptyCatalogue())).toThrow("Historical episode availability");
    const c=catalogue();c.seasons[0].episodes[0].air_date=null;
    expect(()=>buildRewatch(media,{date,scope:{kind:"WHOLE_TITLE"}},c)).toThrow("Historical episode availability");
    const r=buildRewatch(media,{date,scope:{kind:"UNKNOWN"},replaces:"old"},emptyCatalogue());
    expect(r).toMatchObject({scope_kind:"UNKNOWN",scope_confidence:"UNKNOWN",ranges:[],supersedes_id:"old",origin:"USER_CORRECTION"});
  });
  it("never substitutes announced counts when precise membership is incomplete",()=>{
    const c=catalogue();c.seasons[0].episodes.pop();
    expect(()=>buildRewatch(media,{date:null,scope:{kind:"WHOLE_TITLE"}},c)).toThrow("Refresh season details");
  });
  it("handles noncontiguous eligible episodes without inventing the gap",()=>{
    const c=catalogue();c.seasons[0].episodes[1].air_date="2027-01-01";c.seasons[0].episodes[1].aired=false;c.seasons[0].aired=2;
    const r=buildRewatch(media,{date:{year:2022,month:null,day:null},scope:{kind:"WHOLE_TITLE"}},c);
    expect(r.ranges.map(r=>[r.episode_from,r.episode_to])).toEqual([[1,1],[3,3]]);
  });
  it("rejects future periods and invalid dates while retaining partial date precision",()=>{
    expect(()=>rewatchCutoff({year:2027,month:null,day:null})).toThrow("future");
    expect(()=>rewatchCutoff({year:2026,month:11,day:null})).toThrow("future");
    expect(()=>rewatchCutoff({year:2026,month:10,day:22})).toThrow("future");
    expect(()=>rewatchCutoff({year:2024,month:2,day:30})).toThrow();
    expect(rewatchCutoff({year:2024,month:2,day:null})).toBe("2024-02-29");
  });
});


describe("Scoped availability isolation",()=>{
  it("does not let missing future-season dates block a selected older season",()=>{
    const c=catalogue();c.seasons[1].aired=null;c.seasons[1].episodes.forEach(e=>{e.air_date=null;e.aired=null;});
    const request={date:{year:2022,month:null,day:null},scope:{kind:"SEASON" as const,number:1}};
    expect(rangeCount(buildRewatch(media,request,c).ranges)).toBe(3);
    expect(()=>buildRewatch(media,{...request,scope:{kind:"WHOLE_TITLE"}},c)).toThrow("Historical episode availability");
  });
});


describe("Movie release bounds",()=>{
  it("rejects a rewatch before the known release without changing partial-date precision",()=>{
    const film={type:"film",runtime:120,release_date:"2022-11-01"};
    expect(()=>buildRewatch(film,{date:{year:2022,month:10,day:null},scope:{kind:"WHOLE_TITLE"}},emptyCatalogue())).toThrow("not been released");
    expect(buildRewatch(film,{date:{year:2022,month:null,day:null},scope:{kind:"WHOLE_TITLE"}},emptyCatalogue())).toMatchObject({date_precision:"YEAR",month:null,day:null,ranges:[{minutes:120}]});
  });
});
