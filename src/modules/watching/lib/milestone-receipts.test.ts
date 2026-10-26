import { describe,it,expect } from "vitest";
import { receiptMetrics,rawThresholdMet,withUnlockReceipts,type ReceiptSnapshot,type UnlockReceipt } from "./milestone-receipts";
import { computeStats } from "../components/stats/computeStats";
import { computeWatchingAchievements } from "../components/stats/achievements";
import type { StatsRawItem } from "../service";
import { assertion,viewingDate } from "./viewing-history";

function snapshot(count=1):ReceiptSnapshot {
  const items=Array.from({length:count},(_,i)=>({id:`m${i}`,tmdb_id:i+1,type:"film",title:"Film",runtime:999,watched:true,
    favorite:false,season_episodes:null,season_aired:null,current_season:null,current_episode:null,season_years:null,cour_years:null,year:2020,tags:["Drama"],directors:[],watched_at:"2022-12-31",original_title:null,poster_url:null,backdrop_url:null,episodes:null,user_rating:null,
    in_progress:false,paused:false,dropped:false,updated_at:null,season_ratings:null,season_posters:null,cour_ratings:null,season_end_dates:null,status:null,caught_up_at:null} as StatsRawItem));
  const records=items.map((i,n)=>({...assertion("FIRST_WATCH",viewingDate({year:2026,month:null,day:null}),[
    {season_key:"movie",season_number_at_recording:0,episode_from:1,episode_to:1,episode_ids:null,minutes:120,duration_basis:"RUNTIME_SNAPSHOT"}]),
    id:`r${n}`,media_item_id:i.id,work_key:`movie:${i.tmdb_id}`,title_snapshot:i.title,media_type_snapshot:"film",recorded_at:"2026-10-21T10:00:00Z",retracted_at:null}));
  return {items,history:{records,ratings:[]},cours:[],rewatches:[],source_hash:"hash",measured_at:"2026-10-21T10:00:00Z"};
}
const receipt:UnlockReceipt={achievement_key:"cinephile",metric_key:"watching:cinephile:v1",target:350,actual_value:350,
  observed_at:"2026-10-21T10:00:00Z",observation_kind:"FIRST_OBSERVED_SATISFIED",rule_version:1};
describe("Wave2D authoritative milestone observations",()=>{
  it.each([99,99.6,99.999])("does not unlock rounded %s/100",value=>expect(rawThresholdMet(value,100)).toBe(false));
  it("compares raw thresholds and rejects invalid values",()=>{
    expect(rawThresholdMet(100,100)).toBe(true);expect(rawThresholdMet(150,100)).toBe(true);
    expect(rawThresholdMet(Infinity,100)).toBe(false);expect(rawThresholdMet(NaN,100)).toBe(false);
  });
  it("accepts owner-approved legacy completion for badges, preserving strict Goal completion",()=>{
    const s=snapshot(350);s.history.records=[];
    expect(receiptMetrics(s).achievements.find(a=>a.achievement_key==="cinephile")?.actual_value).toBe(350);
    expect(receiptMetrics(s).goalValue("films",null)).toBe(0);
    expect(receiptMetrics(s).liveGoalValue("films",null)).toBe(350);
    const fresh=receiptMetrics(snapshot(350));
    expect(fresh.achievements.find(a=>a.achievement_key==="cinephile")?.actual_value).toBe(350);
    expect(fresh.achievements.find(a=>a.achievement_key==="marathoner")?.actual_value).toBe(700);
  });
  it("preserves unknown/YEAR precision without manufacturing monthly activity",()=>{
    const s=snapshot();expect(receiptMetrics(s).goalValue("films",2026)).toBe(1);
    expect(receiptMetrics(s).achievements.find(a=>a.achievement_key==="ever_present")?.actual_value).toBe(0);
    s.history.records[0]={...s.history.records[0],...viewingDate()};
    expect(receiptMetrics(s).goalValue("films",2026)).toBe(0);expect(receiptMetrics(s).goalValue("films",null)).toBe(1);
  });
  it("deduplicates repeated records and overlapping first consumption without doubling hours",()=>{
    const s=snapshot();s.history.records.push({...s.history.records[0]},{...s.history.records[0],id:"different-id"});
    expect(receiptMetrics(s).stats.hours.total).toBe(2);expect(receiptMetrics(s).goalValue("films",null)).toBe(1);
    expect(receiptMetrics(s).achievements.find(a=>a.achievement_key==="marathoner")?.actual_value).toBe(2);
    expect(computeStats(s.items,s.rewatches,null,new Map(),s.history).hours.total).toBe(2);
  });
  it("does not turn completion milestones or unknown duration into extra hours",()=>{
    const s=snapshot();s.history.records.push({...s.history.records[0],id:"completion",kind:"COMPLETION",completion_basis:"FINISHED_TITLE",
      ranges:s.history.records[0].ranges.map(r=>({...r,minutes:0,duration_basis:"MILESTONE"}))});
    expect(receiptMetrics(s).stats.hours.total).toBe(2);
    s.history.records=s.history.records.slice(1);
    expect(receiptMetrics(s).goalValue("films",null)).toBe(1);expect(receiptMetrics(s).stats.hours.total).toBe(0);
  });
  it("keeps history through library deletion without fabricating metadata",()=>{
    const s=snapshot();s.items=[];s.history.records[0].media_item_id=null;
    expect(receiptMetrics(s).goalValue("films",null)).toBe(1);
  });
  it("retains permanent unlock/date after live corrections and provider drops",()=>{
    const live=computeWatchingAchievements(snapshot(349).items,0,[]);
    const a=withUnlockReceipts(live,[receipt]).find(a=>a.key==="cinephile")!;
    expect(a.unlocked).toBe(true);expect(a.detail.value).toBe(349);expect(a.detail.unlockedAt).toBe(receipt.observed_at);
    expect(a.progressLabel).toContain("349 / 350");
  });
  it("does not infer a receipt/date from currently high legacy totals",()=>{
    const a=withUnlockReceipts(computeWatchingAchievements(snapshot(400).items,0,[]),[]).find(a=>a.key==="cinephile")!;
    expect(a.unlocked).toBe(false);expect(a.detail.unlockedAt).toBeNull();expect(a.detail.value).toBe(400);
  });
  it("keeps rating achievements live rather than awarding permanent opinion receipts",()=>{
    const s=snapshot(25);s.items.forEach(i=>i.user_rating=10);
    expect(receiptMetrics(s).achievements.some(a=>a.achievement_key==="connoisseur")).toBe(false);
    expect(withUnlockReceipts(computeWatchingAchievements(s.items,0,[]),[]).find(a=>a.key==="connoisseur")?.unlocked).toBe(true);
  });
  it("does not turn imported legacy uncertainty into permanent proof",()=>{
    const s=snapshot();s.history.records[0].origin="LEGACY_IMPORT";
    expect(receiptMetrics(s).goalValue("films",null)).toBe(0);
    expect(receiptMetrics(s).liveGoalValue("films",null)).toBe(1);
  });
  it("uses frozen finished anime membership after a provider count regression",()=>{
    const s=snapshot();s.items[0]={...s.items[0],type:"anime",season_aired:[100],season_episodes:[100]};
    s.history.records[0]={...s.history.records[0],work_key:"tv:1",media_type_snapshot:"anime",kind:"COMPLETION",completion_basis:"FINISHED_TITLE",
      ranges:[{season_key:"tmdb-season:1",season_number_at_recording:1,episode_from:1,episode_to:100,episode_ids:null,minutes:0,duration_basis:"MILESTONE"}]};
    const value=()=>receiptMetrics(s).achievements.find(a=>a.achievement_key==="long_hauler")?.actual_value;
    expect(value()).toBe(100);s.items[0].season_aired=[0];s.items[0].season_episodes=[0];expect(value()).toBe(100);
  });

  it("does not complete a finish-series Goal from partial first-watch activity",()=>{
    const s=snapshot();s.items[0]={...s.items[0],type:"serie",watched:false,in_progress:true,season_aired:[10],season_episodes:[10]};
    s.history.records[0]={...s.history.records[0],work_key:"tv:1",media_type_snapshot:"serie",
      ranges:[{season_key:"tmdb-season:1",season_number_at_recording:1,episode_from:1,episode_to:5,episode_ids:null,minutes:100,duration_basis:"RUNTIME_SNAPSHOT"}]};
    expect(receiptMetrics(s).goalValue("series",null)).toBe(0);expect(receiptMetrics(s).liveGoalValue("series",null)).toBe(0);
    s.history.records.push({...s.history.records[0],id:"finished",kind:"COMPLETION",completion_basis:"FINISHED_TITLE",ranges:[{...s.history.records[0].ranges[0],minutes:0,duration_basis:"MILESTONE"}]});
    expect(receiptMetrics(s).goalValue("series",2026)).toBe(1);
  });

  it("keeps inferred dates out of permanent annual eligibility",()=>{
    const s=snapshot();s.history.records[0].date_confidence="INFERRED";
    expect(receiptMetrics(s).goalValue("films",2026)).toBe(0);
    expect(receiptMetrics(s).goalValue("films",null)).toBe(1);
  });

});

describe("Marathoner shares the canonical Stats hours contract",()=>{
  it.each([2999.999,3000,3331.0333333333333])("evaluates raw %s hours from the server snapshot, including accepted legacy time",hours=>{
    const s=snapshot(2);s.items[0].runtime=hours*60-120;s.history.records=[s.history.records[1]];
    const live=computeStats(s.items,s.rewatches,null,new Map(),s.history);
    const metric=receiptMetrics(s).achievements.find(a=>a.achievement_key==="marathoner")!;
    expect(metric.actual_value).toBe(live.hours.total);
    expect(metric.actual_value).toBeCloseTo(hours,10);
    expect(rawThresholdMet(metric.actual_value,metric.target)).toBe(hours>=3000);
    expect(withUnlockReceipts(computeWatchingAchievements(s.items,live.hours.total,[]),[]).find(a=>a.key==="marathoner")?.unlocked).toBe(false);
  });
  it("accepts legacy-only known hours but never guesses unknown duration or consumes browser progress",()=>{
    const s=snapshot(2);s.history.records=[];s.items[0].runtime=180001;s.items[1].runtime=null;
    const metric=()=>receiptMetrics(s).achievements.find(a=>a.achievement_key==="marathoner")!;
    expect(metric().actual_value).toBe(180001/60);expect(rawThresholdMet(metric().actual_value,3000)).toBe(true);
    const prospective={...receipt,achievement_key:"marathoner",metric_key:"watching:marathoner:v1",target:3000,actual_value:metric().actual_value};
    const badge=withUnlockReceipts(computeWatchingAchievements(s.items,metric().actual_value,[]),[prospective]).find(a=>a.key==="marathoner")!;
    expect(badge.unlocked).toBe(true);expect(badge.detail.unlockedAt).toBe(receipt.observed_at);
    s.items[0].runtime=60;expect(rawThresholdMet(metric().actual_value,3000)).toBe(false);
    expect(withUnlockReceipts(computeWatchingAchievements(s.items,1,[]),[prospective]).find(a=>a.key==="marathoner")?.unlocked).toBe(true);
  });
});

describe("Stable retained local identities",()=>{
  it.each(["film","serie","anime"])("retains %s consumption after deletion and counts a returning local identity once",type=>{
    const s=snapshot();s.items=[];
    const range={...s.history.records[0].ranges[0],season_number_at_recording:type==="film" ? 0:1,minutes:120};
    s.history.records[0]={...s.history.records[0],work_key:"local:original-id",media_item_id:null,media_type_snapshot:type,ranges:[range]};
    if(type!=="film") s.history.records.push({...s.history.records[0],id:"completion",kind:"COMPLETION",completion_basis:"FINISHED_TITLE",ranges:[{...range,minutes:0,duration_basis:"MILESTONE"}]});
    const key=type==="film" ? "films":type==="serie" ? "series":"anime";
    const before=receiptMetrics(s);
    expect(before.stats.hours.total).toBe(2);expect(before.goalValue(key,null)).toBe(1);
    expect(before.achievements.find(a=>a.achievement_key==="marathoner")?.actual_value).toBe(2);
    s.items=[{...snapshot().items[0],id:"original-id",tmdb_id:null,type,runtime:999}];
    const returned=receiptMetrics(s);
    expect(returned.stats.hours.total).toBe(2);expect(returned.goalValue(key,null)).toBe(1);
    expect(returned.achievements.find(a=>a.achievement_key==="marathoner")?.actual_value).toBe(2);
  });
});
