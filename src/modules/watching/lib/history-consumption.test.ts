import { describe,it,expect } from "vitest";
import { buildRewatch,emptyCatalogue,parseEpisodeRanges,type RewatchCatalogue } from "./rewatch";
import { assertion,viewingDate,type ViewingRange } from "./viewing-history";
import { buildMediaView } from "./media-view";
import { computeStats } from "../components/stats/computeStats";
import { historicalContributions,periodMatches,type HistoricalViewing,type HistoryAnalytics,type HistoricalRating } from "./history-analytics";
import type { StatsRawItem } from "../service";
const date=(y:number,m:number|null=null,d:number|null=null)=>viewingDate({year:y,month:m,day:d});
function item(overrides:Partial<StatsRawItem>={}):StatsRawItem {
  return {id:"item",tmdb_id:42,type:"serie",title:"Fixture",original_title:null,poster_url:null,backdrop_url:null,year:2020,runtime:50,season_episodes:[13],season_aired:[13],episodes:13,
    user_rating:8.5,favorite:false,watched_at:null,tags:null,directors:null,watched:true,in_progress:false,paused:false,dropped:false,current_season:1,current_episode:13,updated_at:"2026-10-18",
    season_years:{1:2022},season_ratings:{1:9},season_posters:null,cour_years:null,cour_ratings:null,season_end_dates:null,status:"ended",caught_up_at:null,...overrides};
}
const range=(from:number,to:number,season=1,minutes:number|null=(to-from+1)*20):ViewingRange=>({season_key:`tmdb-season:${season}`,season_number_at_recording:season,episode_from:from,episode_to:to,
  episode_ids:Array.from({length:to-from+1},(_,i)=>season*100+from+i),minutes,duration_basis:minutes==null ? "UNKNOWN" : "RUNTIME_SNAPSHOT"});
function record(id:string,ranges:ViewingRange[],year:number|null,kind:HistoricalViewing["kind"]="FIRST_WATCH",month:number|null=null,day:number|null=null):HistoricalViewing {
  return {...assertion(kind,year==null ? viewingDate():date(year,month,day),ranges),id,ranges,work_key:"tv:42",media_item_id:"item",title_snapshot:"Fixture",media_type_snapshot:"serie",recorded_at:`2026-10-${id.padStart(2,"0")}`,retracted_at:null};
}
const history=(records:HistoricalViewing[],ratings:HistoricalRating[]=[]):HistoryAnalytics=>({records,ratings});
const stats=(i:StatsRawItem,h:HistoryAnalytics,y:number|null)=>computeStats([i],[],y,new Map(),h);
function catalogue(count=13):RewatchCatalogue {return {...emptyCatalogue(),snapshot_id:"snapshot",seasons:[{id:201,number:1,announced:count,aired:count,episodes:Array.from({length:count},(_,i)=>({id:101+i,number:i+1,aired:true}))}],cours:[{id:501,number:1,start:1,end:13}]};}
describe("Wave2C explicit frozen rewatches",()=>{
  it("freezes movie120 minutes, exact date, and never uses later runtime",()=>{
    const r=buildRewatch({type:"film",runtime:120,season_aired:null},{date:{year:2026,month:10,day:18},scope:{kind:"WHOLE_TITLE"}},emptyCatalogue());
    const stored={...record("1",r.ranges,2026,"REWATCH",10,18),work_key:"movie:42",media_type_snapshot:"film"};
    const result=stats(item({type:"film",runtime:999,watched:false}),history([stored]),2026);
    expect(result.rewatches).toBe(1);expect(result.hours.rewatches).toBe(2);expect(result.activity).toEqual([{label:"2026-10",count:1}]);expect(result.dailyActivity).toEqual([{label:"2026-10-18",count:1}]);expect(result.monthlyStats?.[0]).toMatchObject({titles:1,rewatches:1,knownMinutes:120});expect(result.dailyStats?.[0]).toMatchObject({titles:1,rewatches:1,knownMinutes:120});
    expect(r.scope_kind).toBe("WHOLE_TITLE");
  });
  it("freezes season2 only and exact episodes4-8 with real per-episode runtimes",()=>{
    const media={type:"serie",runtime:999,season_aired:[13,10]};
    const r=buildRewatch(media,{date:null,scope:{kind:"SEASON",number:2}},emptyCatalogue());
    expect(r.ranges.map(r=>r.season_number_at_recording)).toEqual([2]);expect(r.ranges[0].episode_to).toBe(10);expect(r.ranges[0].minutes).toBeNull();
    const durations=Object.fromEntries([4,5,6,7,8].map(n=>[`1:${n}`,20+n]));
    const selected=buildRewatch(media,{date:null,scope:{kind:"EPISODES",ranges:parseEpisodeRanges("S1:4-8")}},catalogue(),durations);
    expect(selected.ranges[0]).toMatchObject({episode_from:4,episode_to:8,episode_ids:[104,105,106,107,108],minutes:130});
  });
  it("preserves cour membership after remapping and never invents TV duration",()=>{
    const c=catalogue(),r=buildRewatch({type:"anime",runtime:24,season_aired:[13]},{date:null,scope:{kind:"COUR",number:1,courId:501}},c);
    c.cours[0].start=9;c.cours[0].end=21;
    expect(r.scope_key).toBe("anilist-cour:501");expect(r.ranges[0].episode_ids).toHaveLength(13);expect(r.ranges[0].minutes).toBeNull();
  });
  it("retains trustworthy runtime subtotals when another selected episode is unknown",()=>{
    const r=buildRewatch({type:"serie",runtime:999,season_aired:[13]},{date:null,scope:{kind:"EPISODES",ranges:[{season:1,from:4,to:5}]}},catalogue(),{"1:4":25});
    expect(r.ranges.map(range=>range.minutes)).toEqual([25,null]);
    const result=stats(item({watched:false}),history([record("1",r.ranges,null,"REWATCH")]),null);
    expect(result.hours.total).toBe(25/60);expect(result.unknownDurationEvents).toBe(1);expect(result.episodes).toBe(2);expect(result.rewatches).toBe(1);
  });
  it("rejects implicit, overlapping, out-of-bounds and unavailable scopes",()=>{
    const media={type:"serie",runtime:null,season_aired:[13]};
    expect(()=>buildRewatch(media,{date:null,scope:{kind:"EPISODES",ranges:[]}},catalogue())).toThrow();
    expect(()=>buildRewatch(media,{date:null,scope:{kind:"EPISODES",ranges:parseEpisodeRanges("1:1-5,1:4-8")}},catalogue())).toThrow();
    expect(()=>buildRewatch(media,{date:null,scope:{kind:"SEASON",number:2}},catalogue())).toThrow();
    expect(()=>buildRewatch({...media,season_aired:null},{date:null,scope:{kind:"WHOLE_TITLE"}},emptyCatalogue())).toThrow();
  });
  it("records known local coverage without needing provider network or guessed IDs",()=>{
    const r=buildRewatch({type:"serie",runtime:null,season_aired:[13]},{date:null,scope:{kind:"EPISODES",ranges:[{season:1,from:4,to:8}]}},emptyCatalogue());
    expect(r.ranges[0].episode_ids).toBeNull();expect(r.ranges[0].minutes).toBeNull();
  });
});
describe("Wave2C mixed history and calendar attribution",()=>{
  it("never double counts projection/history/completion or a compatibility rewatch",()=>{
    const first=record("1",[range(1,13)],2026),completion=record("2",[{...range(1,13),minutes:0,duration_basis:"MILESTONE"}],2026,"COMPLETION"),rw=record("3",[range(4,8)],2026,"REWATCH");
    const result=computeStats([item()], [{id:"3",media_item_id:"item",watched_on:"2026-01-01"}],2026,new Map(),history([first,completion,rw]));
    expect(result.counts.total).toBe(1);expect(result.episodes).toBe(18);expect(result.rewatches).toBe(1);expect(result.hours.total).toBe(360/60);
  });
  it("keeps original13 in2023 and only new10 in2026, stable against later provider counts",()=>{
    const h=history([record("1",[range(1,13)],2023),record("2",[range(14,23)],2026)]);
    expect(stats(item({watched:false,season_aired:[99],season_episodes:[99],runtime:999}),h,2023).episodes).toBe(13);
    expect(stats(item({watched:false,season_aired:[99],season_episodes:[99],runtime:999}),h,2026).episodes).toBe(10);
    expect(stats(item({watched:false,season_aired:[99],season_episodes:[99],runtime:999}),h,null).hours.total).toBe(460/60);
  });
  it("preserves nonoverlapping legacy episodes when prospective history starts at14, without moving it to2026",()=>{
    const h=history([record("1",[range(14,23)],2026)]),i=item({season_aired:[23],season_episodes:[23],season_years:{1:2023}});
    expect(stats(i,h,2023).episodes).toBe(13);expect(stats(i,h,2026).episodes).toBe(10);expect(h.records).toHaveLength(1);
  });
  it.each([[2026,null,null,0,0],[2026,10,null,1,0],[2026,10,18,1,1],[null,null,null,0,0]] as const)("respects precision %s/%s/%s",(y,m,d,months,days)=>{
    const result=stats(item(),history([record("1",[range(1,13)],y,"FIRST_WATCH",m,d)]),y);
    expect(result.streaks.activeMonthsCount).toBe(months);expect(result.monthlyStats).toHaveLength(months);expect(result.dailyStats).toHaveLength(days);expect(result.dailyActivity).toHaveLength(days);
    if(y==null) expect(result.availableYears).toEqual([]);
    expect(periodMatches(y==null ? viewingDate():date(y,m,d),2026,10,18)).toBe(d===18);
  });
  it("accepts legacy rewatch calendar dates without inventing scope or duration",()=>{
    const result=computeStats([item()], [{id:"legacy",media_item_id:"item",watched_on:"2026-10-01"}],null,new Map(),history([record("1",[range(1,13,1,null)],null)]));
    expect(result.rewatches).toBe(1);expect(result.breakdown.rewatches[0].minutes).toBeNull();expect(result.unknownDurationEvents).toBe(2);expect(result.availableYears).toEqual([2026]);
    expect(result.monthlyStats?.[0]).toMatchObject({label:"2026-10",rewatches:1,knownMinutes:0});
  });
  it("keeps legacy-only annual fallback and suppresses retracted first watches",()=>{
    expect(stats(item(),history([]),2022).episodes).toBe(13);
    const original={...record("1",[range(1,13)],2026),retracted_at:"2026-10-18"};
    expect(stats(item(),history([original]),null).counts.total).toBe(0);
    expect(stats(item(),history([original]),null).hours.total).toBe(0);
  });
  it("partial unverified season history does not erase trustworthy legacy years of other seasons",()=>{
    const coarse={...record("1",[],2026),scope_kind:"SEASON" as const,scope_key:"tmdb-season:2"};
    const i=item({season_aired:[13,10],season_episodes:[13,10],season_years:{1:2022,2:2026}});
    expect(stats(i,history([coarse]),2022).episodes).toBe(13);
    expect(stats(i,history([coarse]),2026).episodes).toBe(0);
    expect(stats(i,history([coarse]),2026).unknownScopeEvents).toBe(1);
  });
  it("counts more than100 history events and only active corrections",()=>{
    const events=Array.from({length:120},(_,i)=>record(String(i+1),[range(1,1)],2026,"REWATCH"));
    events[0].retracted_at="2026-10-18";
    expect(stats(item({watched:false}),history(events),2026).rewatches).toBe(119);
  });
});
function rating(id:string,completion:string,score:number,number=1,previous:string|null=null,count=13):HistoricalRating {
  return {id,media_item_id:"item",work_key:"tv:42",scope_kind:"SEASON",scope_key:`tmdb-season:${200+number}`,scope_number_at_recording:number,viewing_record_id:completion,
    episode_ids:Array.from({length:count},(_,i)=>number*100+i+1),score,previous_rating_id:previous,recorded_at:`2026-10-${id.padStart(2,"0")}`};
}
describe("Wave2C rating context and lineage",()=>{
  it("Black Clover old2022 opinion cannot leak into2026 activity",()=>{
    const h=history([record("1",[range(1,13)],2022),record("2",[range(14,23)],2026),record("3",[{...range(1,13),minutes:0,duration_basis:"MILESTONE"}],null,"COMPLETION")],[rating("1","3",9)]);
    expect(stats(item(),h,2026).counts.total).toBe(1);expect(stats(item(),h,2026).ratedCount).toBe(0);expect(stats(item(),h,2022).topFavorites[0].rating).toBe(9);
  });
  it("Hannibal computes8.75 from two legitimate scopes, confirmations add no vote",()=>{
    const records=[record("1",[range(1,13)],2026),record("2",[range(1,13,2)],2026),record("3",[range(1,13)],null,"COMPLETION"),record("4",[range(1,13,2)],null,"COMPLETION")];
    const ratings=[rating("1","3",8.5),rating("2","4",9,2),rating("3","4",9,2,"2")];
    const result=stats(item({season_aired:[13,13],season_episodes:[13,13]}),history(records,ratings),2026);
    expect(result.topFavorites[0]).toMatchObject({rating:8.75,seasonLabel:"S1–S2"});expect(result.avgRating).toBe(8.75);expect(result.ratedCount).toBe(1);
  });
  it("follows lineage even if assertion timestamps tie or arrive out of order",()=>{
    const records=[record("1",[range(1,13)],2026),record("2",[range(1,13)],null,"COMPLETION")];
    const first=rating("1","2",9),revision={...rating("2","2",8.5,1,"1"),recorded_at:"2020-01-01"};
    expect(stats(item(),history(records,[first,revision]),2026).topFavorites[0].rating).toBe(8.5);
    const clear={...rating("3","2",9,1,"2"),viewing_record_id:null,score:null};
    expect(stats(item(),history(records,[first,revision,clear]),2026).ratedCount).toBe(0);
  });
  it("expanded23 revision8.5 leaves historical13 opinion9 intact",()=>{
    const h=history([record("1",[range(1,13)],2023),record("2",[range(14,23)],2026),record("3",[range(1,13)],null,"COMPLETION"),record("4",[range(1,23)],null,"COMPLETION")],
      [rating("1","3",9),rating("2","4",9,1,"1",23),rating("3","4",8.5,1,"2",23)]);
    expect(stats(item(),h,2023).topFavorites[0].rating).toBe(9);expect(stats(item(),h,2026).topFavorites[0].rating).toBe(8.5);
  });
});


describe("Wave2C blocker regressions",()=>{
  it("subtracts only exact partial overlap from legacy13",()=>{
    const result=stats(item(),history([record("1",[range(4,8)],2026)]),null);
    expect(result.episodes).toBe(13);
    expect(result.breakdown.serie[0]).toMatchObject({episodes:13,source:"MIXED",minutes:500});
    expect(stats(item(),history([record("1",[range(4,8)],2026)]),2022).episodes).toBe(8);
  });
  it("retraction masks only removed4-8, keeping unrelated legacy1-3 and9-13",()=>{
    const old={...record("1",[range(4,8)],2026),retracted_at:"2026-10-20"};
    expect(stats(item(),history([old]),null).episodes).toBe(8);
    const replacement={...record("2",[range(5,7)],2026),supersedes_id:"1"};
    expect(stats(item(),history([old,replacement]),null).episodes).toBe(11);
  });
  it("deduplicates disjoint2-3 and9-10 against legacy13",()=>{
    expect(stats(item(),history([record("1",[range(2,3)],2026),record("2",[range(9,10)],2026)]),null).episodes).toBe(13);
  });
  it.each(["WHOLE_TITLE","SEASON","COUR","EPISODES"] as const)("uses frozen ranges for %s overlap",scope=>{
    const event={...record("1",[range(4,8)],2026),scope_kind:scope};
    expect(stats(item(),history([event]),null).episodes).toBe(13);
  });
  it("counts movie first watch plus completion only once",()=>{
    const movieRange={...range(1,1,0,120),season_key:"movie"};
    const records=[record("1",[movieRange],2026),record("2",[{...movieRange,minutes:0,duration_basis:"MILESTONE"}],2026,"COMPLETION")]
      .map(r=>({...r,work_key:"movie:42",media_type_snapshot:"film"}));
    const result=stats(item({type:"film",watched:false}),history(records),null);
    expect(result.counts.total).toBe(1);expect(result.hours.total).toBe(2);expect(result.unknownDurationEvents).toBe(0);
  });
  it("counts first1-10 plus season completion1-10 once",()=>{
    const completion=record("2",[{...range(1,10),minutes:0,duration_basis:"MILESTONE"}],null,"COMPLETION");
    const result=stats(item({watched:false}),history([record("1",[range(1,10)],2026),completion]),null);
    expect(result.episodes).toBe(10);expect(result.hours.total).toBe(200/60);
  });
  it("retains completion-only consumption without legacy or current metadata",()=>{
    const completion={...record("1",[{...range(1,10),minutes:0,duration_basis:"MILESTONE"}],null,"COMPLETION"),media_item_id:null};
    const result=stats(item({watched:false,season_aired:null,season_episodes:null,runtime:999}),history([completion,{...completion,id:"2"}]),null);
    expect(result.counts.total).toBe(1);expect(result.episodes).toBe(10);expect(result.hours.total).toBe(0);
    expect(result.unknownDurationEvents).toBe(1);expect(result.availableYears).toEqual([]);
  });
  it("prefers usable legacy over completion-only milestone",()=>{
    const result=stats(item(),history([record("1",[{...range(1,13),minutes:0,duration_basis:"MILESTONE"}],null,"COMPLETION")]),null);
    expect(result.episodes).toBe(13);expect(result.hours.total).toBe(650/60);expect(result.unknownDurationEvents).toBe(0);
  });
  it("adds only uncovered frozen completion membership with unknown duration",()=>{
    const completion=record("2",[{...range(1,10),minutes:0,duration_basis:"MILESTONE"}],null,"COMPLETION");
    const result=stats(item({watched:false}),history([record("1",[range(4,8)],2026),completion]),null);
    expect(result.episodes).toBe(10);expect(result.hours.total).toBe(100/60);expect(result.unknownDurationEvents).toBe(1);
  });
  it("keeps ambiguous completion uncertain, never expanding from current counts/runtime",()=>{
    const result=stats(item({watched:false}),history([record("1",[],null,"COMPLETION")]),null);
    expect(result.counts.total).toBe(1);expect(result.episodes).toBe(0);expect(result.unknownScopeEvents).toBe(1);expect(result.unknownDurationEvents).toBe(1);
    expect(result.hours.total).toBe(0);
  });
  it("does not resurrect removed first-watch coverage through completion",()=>{
    const first={...record("1",[range(4,8)],2026),retracted_at:"2026-10-20"};
    const completion=record("2",[{...range(1,13),minutes:0,duration_basis:"MILESTONE"}],null,"COMPLETION");
    expect(stats(item({watched:false}),history([first,completion]),null).episodes).toBe(8);
  });
  it("blocks aired-count cour offset guesses, then allows retry with trusted membership",()=>{
    const media={type:"anime",runtime:24,season_aired:[12,12],season_episodes:[24,12]};
    const request={date:null,scope:{kind:"COUR" as const,number:1,courId:501}};
    const ambiguous={...emptyCatalogue(),cours:[{id:501,number:1,start:13,end:24}]};
    expect(()=>buildRewatch(media,request,ambiguous)).toThrow("Refresh season details");
    const trusted=catalogue(24);trusted.cours=[{id:501,number:1,start:13,end:24}];
    const frozen=buildRewatch(media,request,trusted);
    expect(frozen.ranges[0]).toMatchObject({season_number_at_recording:1,episode_from:13,episode_to:24});
    trusted.cours[0].number=2;trusted.cours[0].start=25;trusted.seasons[0].announced=99;
    expect(frozen.ranges[0]).toMatchObject({season_number_at_recording:1,episode_from:13,episode_to:24});
    expect(frozen.ranges[0].episode_ids).toEqual(Array.from({length:12},(_,i)=>113+i));
  });
  it("blocks incomplete/announced-only cour membership even with a snapshot token",()=>{
    const c=catalogue(24);c.cours=[{id:501,number:1,start:13,end:24}];c.seasons[0].aired=12;
    const request={date:null,scope:{kind:"COUR" as const,number:1,courId:501}};
    expect(()=>buildRewatch({type:"anime",runtime:null},request,c)).toThrow("Refresh season details");
    c.seasons[0].aired=24;c.seasons[0].episodes=[];
    expect(()=>buildRewatch({type:"anime",runtime:null},request,c)).toThrow("Refresh season details");
  });
});

describe("Accepted stored legacy calendar dates",()=>{
  it.each(["2022-03-14","2023-03-14","2024-03-14","2025-08-10"])("uses %s for annual, monthly and daily analytics without a cutoff",stored=>{
    const [year,month,day]=stored.split("-").map(Number);
    const result=stats(item({type:"film",watched_at:stored}),history([]),year);
    expect(result.counts.total).toBe(1);
    expect(result.activity).toEqual([{label:stored.slice(0,7),count:1}]);
    expect(result.monthlyStats?.[0]).toMatchObject({label:stored.slice(0,7),titles:1});
    expect(result.dailyActivity).toEqual([{label:stored,count:1}]);
    expect(result.dailyStats?.[0].label).toBe(`${year}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}`);
  });
  it("keeps unrelated legacy calendar coverage after partial history adoption, replacing only overlap",()=>{
    const i={...item({season_aired:[13,10],season_episodes:[13,10],season_years:{1:2022,2:2026},watched_at:"2022-03-14"}),history_version:1};
    const h=history([record("1",[range(4,8)],2026,"FIRST_WATCH",10,21)]);
    const old=stats(i,h,2022),fresh=stats(i,h,2026),all=stats(i,h,null);
    expect(old.activity).toEqual([{label:"2022-03",count:1}]);
    expect(old.monthlyStats?.[0]).toMatchObject({episodes:8,titles:1});
    expect(old.dailyStats?.[0]).toMatchObject({label:"2022-03-14",episodes:8});
    expect(fresh.monthlyStats?.[0]).toMatchObject({label:"2026-10",episodes:5});
    expect(fresh.episodes).toBe(15); // S2 retains its explicit year, without a made-up month.
    expect(all.episodes).toBe(23);
    expect(all.monthlyStats?.reduce((n,row)=>n+row.episodes,0)).toBe(13);
  });
  it("does not duplicate a fully replaced legacy movie date",()=>{
    const r={...record("1",[{...range(1,1,0,120),season_key:"movie"}],2025,"FIRST_WATCH",8,10),work_key:"movie:42",media_type_snapshot:"film"};
    const i={...item({type:"film",watched_at:"2022-03-14"}),history_version:1};
    expect(stats(i,history([r]),2022).activity).toEqual([]);
    expect(stats(i,history([r]),2025).monthlyStats?.[0]).toMatchObject({titles:1,knownMinutes:120});
    expect(stats(i,history([r]),null).hours.total).toBe(2);
  });
  it("preserves explicitly partial dates rather than decoding their sorting projection",()=>{
    const i=item({type:"film",watched_at:"2022-12-31T12:00:00Z",viewing_date:{year:2022,month:null,day:null}});
    expect(stats(i,history([]),2022).activity).toEqual([]);
    expect(stats(i,history([]),2022).counts.total).toBe(1);
    i.viewing_date={year:2022,month:3,day:null};
    expect(stats(i,history([]),2022).activity).toEqual([{label:"2022-03",count:1}]);
    expect(stats(i,history([]),2022).dailyStats).toEqual([]);
  });
  it("accepts a pre-2024 legacy rewatch date but never duplicates its canonical replacement",()=>{
    const r={...record("rw",[{...range(1,1,0,120),season_key:"movie"}],2022,"REWATCH",3,14),work_key:"movie:42",media_type_snapshot:"film"};
    const i=item({type:"film",watched:false});
    const legacy=[{id:"rw",media_item_id:i.id,watched_on:"2022-03-14"}];
    const before=computeStats([i],legacy,2022,new Map(),history([]));
    expect(before.activity).toEqual([{label:"2022-03",count:1}]);
    expect(before.dailyActivity).toEqual([{label:"2022-03-14",count:1}]);
    expect(before.hours.total).toBe(0);expect(before.unknownScopeEvents).toBe(1);
    const after=computeStats([i],legacy,2022,new Map(),history([r]));
    expect(after.rewatches).toBe(1);expect(after.hours.total).toBe(2);
    expect(after.activity).toEqual([{label:"2022-03",count:1}]);
  });
});

describe("Monthly activity preserves stored dates independently of annual scope stamps",()=>{
  it("keeps Bleach-like legacy2023 dates when partial history introduces a2026 viewing_date",()=>{
    const i={...item({season_episodes:[13,10],season_aired:[13,10],season_years:{1:2023,2:2026},watched_at:"2023-12-31",viewing_date:{year:2026,month:10,day:20}}),history_version:1};
    const h=history([record("1",[range(1,2,2)],2026,"FIRST_WATCH",10,20)]);
    const old=stats(i,h,2023),fresh=stats(i,h,2026),all=stats(i,h,null);
    expect(old.activity).toEqual([{label:"2023-12",count:1}]);
    expect(old.dailyActivity).toEqual([{label:"2023-12-31",count:1}]);
    expect(old.monthlyStats?.[0]).toMatchObject({episodes:13,knownMinutes:650});
    expect(fresh.activity).toEqual([{label:"2026-10",count:1}]);
    expect(fresh.monthlyStats?.[0]).toMatchObject({episodes:2,knownMinutes:40});
    expect(fresh.episodes).toBe(10);expect(all.episodes).toBe(23);
    expect(all.hours.total).toBe((21*50+40)/60);
  });
  it("retains a Dexter-like stored April2026 event despite annual season stamps2023",()=>{
    const i=item({watched_at:"2026-04-05",season_years:{1:2023}});
    expect(stats(i,history([]),2026).activity).toEqual([{label:"2026-04",count:1}]);
    expect(stats(i,history([]),2026).monthlyStats?.[0]).toMatchObject({titles:1,episodes:0,knownMinutes:0,unknownDurationEvents:1});
    expect(stats(i,history([]),2023).episodes).toBe(13); // No annual hours/episodes moved to2026.
    expect(stats(i,history([]),2026).episodes).toBe(0);
    expect(stats(i,history([]),null).hours.total).toBe(650/60);
  });
  it("does not resurrect a stored calendar date after all corresponding legacy coverage is replaced",()=>{
    const i=item({watched_at:"2023-12-31",season_years:{1:2023}});
    const h=history([record("1",[range(1,13)],2026,"FIRST_WATCH",10,20)]);
    expect(stats(i,h,2023).activity).toEqual([]);
    expect(stats(i,h,2026).activity).toEqual([{label:"2026-10",count:1}]);
  });
});

it("unscoped history with only a year cannot mask dated legacy coverage",()=>{
  const i=item({watched_at:"2022-03-14"});
  const result=stats(i,history([record("unknown",[],2022)]),2022);
  expect(result.activity).toEqual([{label:"2022-03",count:1}]);
  expect(result.episodes).toBe(13);expect(result.hours.total).toBe(650/60);
});

describe("Same-year scoped date adoption",()=>{
  it.each([viewingDate({year:2026,month:10,day:20}),viewingDate({year:2026,month:10,day:null})])("preserves March legacy while newer scoped history uses $date_precision in October",d=>{
    const i={...item({season_aired:[13,10],season_episodes:[13,10],season_years:{1:2026,2:2026},watched_at:"2026-03-14",viewing_date:{year:d.year!,month:d.month,day:d.day}}),history_version:1};
    const h=history([{...record("1",[range(1,2,2)],2026),...d}]);
    const result=stats(i,h,2026);
    expect(result.activity).toEqual([{label:"2026-03",count:1},{label:"2026-10",count:1}]);
    expect(result.monthlyStats?.map(m=>[m.label,m.episodes])).toEqual([["2026-03",21],["2026-10",2]]);
    expect(result.dailyActivity).toContainEqual({label:"2026-03-14",count:1});
    expect(result.dailyActivity?.some(a=>a.label==="2026-10-20")).toBe(d.day===20);
    expect(result.episodes).toBe(23);expect(result.hours.total).toBe((21*50+40)/60);
  });
  it("does not resurrect the old month when every legacy episode is explicitly replaced",()=>{
    const d=viewingDate({year:2026,month:10,day:20});
    const i=item({watched_at:"2026-03-14",season_years:{1:2026},viewing_date:{year:2026,month:10,day:20}});
    const result=stats(i,history([{...record("1",[range(1,13)],2026),...d}]),2026);
    expect(result.activity).toEqual([{label:"2026-10",count:1}]);expect(result.episodes).toBe(13);
  });
});

it("a scoped YEAR assertion cannot erase the legacy month of unrelated coverage",()=>{
  const i=item({season_aired:[13,10],season_episodes:[13,10],season_years:{1:2026,2:2026},watched_at:"2026-03-14",viewing_date:{year:2026,month:null,day:null}});
  const result=stats(i,history([record("1",[range(1,2,2)],2026)]),2026);
  expect(result.activity).toEqual([{label:"2026-03",count:1}]);
  expect(result.monthlyStats?.[0]).toMatchObject({label:"2026-03",episodes:21});
  expect(result.episodes).toBe(23);
});

describe("Viewing time across New Year",()=>{
  it("keeps December and January hours in their viewing years after Finish and later catalogue growth",()=>{
    const i=item({season_episodes:[20],season_aired:[20],current_episode:20,season_years:{1:2027},watched_at:"2027-01-10",
      legacy_consumption:{version:1,captured_at:"2026-12-01",counts:[0],runtime:24,fallback_year:null,completed:false}});
    const first=record("dec",[range(1,10)],2026,"FIRST_WATCH",12,30);
    const second=record("jan",[range(11,20)],2027,"FIRST_WATCH",1,10);
    const finish=record("finish",[range(1,20)],2027,"COMPLETION",1,10);
    const h=history([first,second,finish]);
    const before=[2026,2027].map(y=>computeStats([i],[],y,new Map(),h));
    expect(before.map(s=>s.hours.total)).toEqual([200/60,200/60]);
    expect(before.map(s=>s.episodes)).toEqual([10,10]);
    expect(before[0].breakdown.serie[0].seasonLabel).toBe("Season 1 · EP1–10");
    expect(before[0].monthlyStats.find(m=>m.label==="2026-12")?.knownMinutes).toBe(200);
    const grown={...i,watched:false,in_progress:true,season_episodes:[20,10],season_aired:[20,4],runtime:99};
    expect([2026,2027].map(y=>computeStats([grown],[],y,new Map(),h).hours.total)).toEqual(before.map(s=>s.hours.total));
    expect(computeStats([i],[],null,new Map(),h).hours.total).toBe(400/60);
  });
});

describe("Part opinions do not double vote with their enclosing season",()=>{
  it("keeps the part score and its historical year independent of later season growth",()=>{
    const first=record("watch",[range(1,13)],2023);
    const complete=record("complete",[range(1,13)],2023,"COMPLETION");
    const whole=rating("1","complete",8),part={...rating("2","complete",9),scope_kind:"COUR" as const,scope_key:"anilist-cour:501"};
    const h=history([first,complete],[whole,part]);
    expect(stats(item({season_years:{1:2023}}),h,2023).avgRating).toBe(9);
    expect(stats(item({season_years:{1:2023}}),h,2026).ratedCount).toBe(0);
  });
});

describe("Part history retains storage-season artwork",()=>{
  it("uses frozen S2 ranges for a cour rewatch on a multi-season anime",()=>{
    const i=item({type:"anime",season_episodes:[3,6],season_aired:[3,6],current_season:2,current_episode:6,season_years:{1:2020,2:2023},season_posters:["/s1.jpg","/s2.jpg"]});
    const rw={...record("part-rewatch",[range(3,6,2)],2026,"REWATCH"),scope_kind:"COUR" as const,scope_key:"anilist-cour:990103"};
    const result=stats(i,history([rw]),2026);
    expect(result.hours.rewatches).toBe(80/60);
    expect(historicalContributions(i,buildMediaView({type:"anime",season_episodes:[3,6],season_aired:[3,6],current_season:2,current_episode:6},null),history([rw]),[])[0].displaySeasons).toEqual([2]);
  });
});


describe("Top Picks exclude frozen rewatch-only years",()=>{
  it.each(["film","serie","anime"] as const)("keeps %s rewatch hours/activity without admitting it to annual picks",type=>{
    const media=item({type,watched_at:"2022-06-01",favorite:true,season_years:{1:2022}});
    const rewatch={...record("rewatch",[range(1,type==="film" ? 1:13,type==="film" ? 0:1,120)],2026,"REWATCH",4,7),
      work_key:type==="film" ? "movie:42":"tv:42",media_type_snapshot:type};
    const h=history([rewatch]),annual=stats(media,h,2026);
    expect(annual.topFavorites).toEqual([]);
    expect(annual.hours.rewatches).toBe(2);
    expect(annual.rewatches).toBe(1);
    expect(annual.counts.total).toBe(1);
    expect(annual.activity).toEqual([{label:"2026-04",count:1}]);
    expect(stats(media,h,2022).topFavorites[0].item.id).toBe(media.id);
    expect(stats(media,h,null).topFavorites[0].item.id).toBe(media.id);
  });
  it("keeps a title eligible when its first viewing and rewatch are both in the selected year",()=>{
    const media=item({type:"film",watched_at:"2026-02-01",favorite:true});
    const first={...record("first",[range(1,1,0,120)],2026,"FIRST_WATCH",2,1),work_key:"movie:42",media_type_snapshot:"film"};
    const rewatch={...first,id:"rewatch",kind:"REWATCH" as const,month:4,day:7};
    const annual=stats(media,history([first,rewatch]),2026);
    expect(annual.topFavorites.map(e=>e.item.id)).toEqual([media.id]);
    expect(annual.hours.film).toBe(2);expect(annual.hours.rewatches).toBe(2);
    expect(annual.counts.total).toBe(1);
  });
  it("does not assign an undated first viewing to its dated rewatch year",()=>{
    const media=item({type:"film",watched_at:null,favorite:true});
    const first={...record("first",[range(1,1,0,120)],null),work_key:"movie:42",media_type_snapshot:"film"};
    const rewatch={...first,id:"rewatch",kind:"REWATCH" as const,...date(2026,4,7)};
    const h=history([first,rewatch]);
    expect(stats(media,h,2026).topFavorites).toEqual([]);
    expect(stats(media,h,null).topFavorites.map(e=>e.item.id)).toEqual([media.id]);
    expect(stats(media,h,2026).hours.rewatches).toBe(2);
  });
});


it("a confirmed year-only part correction replaces only its legacy overlap, preserving total and precise later dates",()=>{
  const media=item({type:"anime",season_aired:[366,50],season_episodes:[366,50],current_season:2,current_episode:50,
    season_years:{1:2020,2:2023},runtime:24,watched_at:"2026-10-28",
    legacy_consumption:{version:1,captured_at:"2026-10-22",counts:[366,49],runtime:24,fallback_year:2026,completed:false,storage_sizes:[366,50],calendar_date:"2023-12-31"}});
  const existing=[record("49",[range(49,49,2,24)],2026,"FIRST_WATCH",10,20),record("50",[range(50,50,2,24)],2026,"FIRST_WATCH",10,28)];
  const before=history(existing),after=history([...existing,{...record("part4",[range(41,48,2,192)],2026),origin:"USER_CORRECTION" as const}]);
  expect(stats(media,before,2023).hours.anime).toBe(19.2);
  expect(stats(media,after,2023).hours.anime).toBe(16);
  expect(stats(media,before,2026).hours.anime).toBe(0.8);
  expect(stats(media,after,2026).hours.anime).toBe(4);
  expect(stats(media,after,null).hours).toEqual(stats(media,before,null).hours);
  expect(stats(media,after,2026).activity).toEqual(stats(media,before,2026).activity);
  expect(stats(media,after,2026).dailyActivity).toEqual(stats(media,before,2026).dailyActivity);
  expect(existing.map(r=>[r.month,r.day])).toEqual([[10,20],[10,28]]);
  expect(media.season_years).toEqual({1:2020,2:2023});
});
