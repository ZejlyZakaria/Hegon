import { describe, expect, it } from "vitest";
import { createLiveGoalEvaluator } from "./live-goal-metrics";
import { assertion, viewingDate, type ViewingRange } from "./viewing-history";
import type { HistoricalViewing } from "./history-analytics";
import type { StatsRawItem } from "../service";
const media:StatsRawItem={original_title:null,poster_url:null,backdrop_url:null,year:2004,episodes:20,user_rating:null,favorite:false,tags:null,directors:null,in_progress:false,paused:false,dropped:false,updated_at:null,season_ratings:null,season_posters:null,cour_years:null,cour_ratings:null,season_end_dates:null,status:"ended",caught_up_at:null,id:"m",tmdb_id:42,type:"anime",title:"Title",watched:true,watched_at:"2023-01-01",season_aired:[10,10],season_episodes:[10,10],current_season:2,current_episode:10,runtime:24,season_years:{1:2020,2:2023}};
const range:ViewingRange={season_key:"s2",season_number_at_recording:2,episode_from:1,episode_to:10,episode_ids:null,minutes:240,duration_basis:"RUNTIME_SNAPSHOT"};
const record=(kind:HistoricalViewing["kind"],year:number,extra:Partial<HistoricalViewing>={})=>({...assertion(kind,viewingDate({year,month:null,day:null}),[range]),id:`${kind}-${year}`,media_item_id:"m",work_key:"tv:42",title_snapshot:"Title",media_type_snapshot:"anime",recorded_at:"2026-10-28",retracted_at:null,...extra} as HistoricalViewing);
describe("shared live goal contribution",()=>{
  it("uses the accepted year instead of a stale global watched_at",()=>{
    const evaluator=createLiveGoalEvaluator([media],new Map(),{records:[record("FIRST_WATCH",2026)],ratings:[]});
    expect(evaluator("anime",2026)).toBe(1);
    expect(evaluator("films",2026)).toBe(0);
  });
  it("excludes rewatch-only years from discovery goals and keeps unfinished series excluded",()=>{
    const records=[record("REWATCH",2026),{...record("REWATCH",2026),id:"again"}];
    expect(createLiveGoalEvaluator([media],new Map(),{records,ratings:[]})("titles",2026)).toBe(0);
    expect(createLiveGoalEvaluator([{...media,watched:false,in_progress:true}],new Map(),{records,ratings:[]})("anime",2026)).toBe(0);
  });
  it("recognizes a canonical finished-title completion despite stale posture, but ignores retracted completion",()=>{
    const completion=record("COMPLETION",2026,{completion_basis:"FINISHED_TITLE"});
    const m={...media,watched:false,in_progress:true};
    expect(createLiveGoalEvaluator([m],new Map(),{records:[record("FIRST_WATCH",2026),completion],ratings:[]})("anime",2026)).toBe(1);
    expect(createLiveGoalEvaluator([m],new Map(),{records:[record("FIRST_WATCH",2026),{...completion,retracted_at:"2026-10-29"}],ratings:[]})("anime",2026)).toBe(0);
  });
});

it("film goals count discoveries once, including same-year first watch plus rewatch",()=>{
 const items=Array.from({length:43},(_,n)=>({...media,id:`film${n}`,tmdb_id:n+1,type:"film" as const,watched_at:n<40?"2026-05-01":"2020-01-01",runtime:120}));
 const records=[items[0],...items.slice(40)].map(i=>({...record("REWATCH",2026),id:`rw${i.id}`,media_item_id:i.id,work_key:`movie:${i.tmdb_id}`,media_type_snapshot:"film"}));
 expect(createLiveGoalEvaluator(items,new Map(),{records,ratings:[]})("films",2026)).toBe(40);
 expect(createLiveGoalEvaluator(items,new Map(),{records,ratings:[]})("films",null)).toBe(43);
});
