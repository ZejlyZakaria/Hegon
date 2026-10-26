import { computeStats } from "../components/stats/computeStats";
import { computeWatchingAchievements, type WatchingAchievement } from "../components/stats/achievements";
import { workKeyOf, deduplicateFirstViewing, type HistoryAnalytics } from "./history-analytics";
import type { StatsRawItem, RewatchStatItem } from "../service";
import type { AnimeCoursRow } from "../types";

export interface UnlockReceipt {
  achievement_key:string; metric_key:string; target:number; actual_value:number;
  observed_at:string; observation_kind:"FIRST_OBSERVED_SATISFIED"; rule_version:number;
}
export interface ReceiptSnapshot {
  items:StatsRawItem[]; history:HistoryAnalytics; cours:AnimeCoursRow[]; rewatches:RewatchStatItem[];
  source_hash:string; measured_at:string;
}
// These describe current opinions, not consumption milestones. Preserve their live semantics.
export const LIVE_ACHIEVEMENTS = new Set(["connoisseur","hall_of_fame"]);
export function withUnlockReceipts(live:WatchingAchievement[],receipts:UnlockReceipt[]):WatchingAchievement[] {
  return live.map(a=>{
    const receipt=receipts.find(r=>r.achievement_key===a.key);
    const liveState=LIVE_ACHIEVEMENTS.has(a.key),unlocked=liveState ? a.unlocked : !!receipt;
    return {...a,unlocked,progressLabel:`Current: ${a.detail.value.toLocaleString("en-GB")} / ${a.detail.goal.toLocaleString("en-GB")}`,
      detail:{...a.detail,unlockedAt:receipt?.observed_at ?? null,receiptObserved:!!receipt}};
  });
}
export function rawThresholdMet(value:number,target:number):boolean {
  return Number.isFinite(value) && Number.isFinite(target) && target>0 && value>=target;
}

/** Fresh server snapshot: one accepted achievement evaluator; Goals keep explicit-history completion. */
export function receiptMetrics(snapshot:ReceiptSnapshot) {
  const unique=deduplicateFirstViewing(snapshot.history.records.filter(r=>r.origin==="USER_ACTION" || r.origin==="USER_CORRECTION"));
  const confirmed=unique.map(r=>r.date_confidence==="CONFIRMED" ? r:{...r,year:null,month:null,day:null,date_precision:"UNKNOWN" as const});
  const history={...snapshot.history,records:confirmed};
  const items=[...snapshot.items],known=new Set(items.map(workKeyOf));
  for(const r of snapshot.history.records) if(!known.has(r.work_key)) {
    known.add(r.work_key);
    items.push({id:`history:${r.work_key}`,tmdb_id:r.work_key.startsWith("local:") ? null:Number(r.work_key.split(":")[1]),
      type:r.media_type_snapshot,title:r.title_snapshot} as StatsRawItem);
  }
  const work=workKeyOf;
  const bare=items.map(i=>({...i,watched:false,in_progress:false,paused:false,dropped:false}));
  const cours=new Map(snapshot.cours.map(c=>[c.tmdb_id,c]));
  let strictStats:ReturnType<typeof computeStats>|undefined;
  const getStrictStats=()=>strictStats ??= computeStats(bare,[],null,cours,history);
  const getCompleted=()=>{
    const stats=getStrictStats();
    const consumed=new Set([...stats.breakdown.film,...stats.breakdown.serie,...stats.breakdown.anime,
      ...stats.breakdown.rewatches.filter(e=>e.item.type==="film" && e.scope==="WHOLE_TITLE")].map(e=>e.item.id));
    return items.filter(i=>i.type==="film" ? consumed.has(i.id):finished.has(work(i)));
  };
  const finished=new Set(unique.filter(r=>!r.retracted_at && r.kind==="COMPLETION" && r.completion_basis==="FINISHED_TITLE").map(r=>r.work_key));
  // The server and UI evaluate the SAME accepted consumption ledger and rules.
  // Goal completion below deliberately retains its stricter explicit-history contract.
  const accepted=computeStats(items,snapshot.rewatches,null,cours,snapshot.history);
  const achievements=computeWatchingAchievements(items,accepted.hours.total,
    [...accepted.breakdown.film,...accepted.breakdown.serie,...accepted.breakdown.anime],accepted.breakdown.rewatches,
    {stats:accepted,history:snapshot.history}).filter(a=>!LIVE_ACHIEVEMENTS.has(a.key)).map(a=>({
      achievement_key:a.key,metric_key:`watching:${a.key}:v1`,target:a.detail.goal,actual_value:a.detail.value,rule_version:1}));
  const matchesType=(i:StatsRawItem,key:string|null)=>key==="films" ? i.type==="film":key==="series" ? i.type==="serie":key==="anime" ? i.type==="anime":true;
  const periodIds=(s:ReturnType<typeof computeStats>)=>new Set([...s.breakdown.film,...s.breakdown.serie,...s.breakdown.anime,...s.breakdown.rewatches].map(e=>e.item.id));
  const strictPeriods=new Map<number|null,ReturnType<typeof computeStats>>(),livePeriods=new Map<number|null,ReturnType<typeof computeStats>>();
  const goalValue=(key:string|null,year:number|null)=>{
    let s=strictPeriods.get(year);
    if(!s){s=year==null ? getStrictStats():computeStats(bare,[],year,cours,history);strictPeriods.set(year,s);}
    const ids=periodIds(s);
    // Goals' series/anime metric remains FINISHED titles, not merely started/active shows.
    return getCompleted().filter(i=>matchesType(i,key) && ids.has(i.id) && (year==null || i.type==="film" ||
      confirmed.some(r=>r.work_key===work(i) && !r.retracted_at && r.kind==="COMPLETION" && r.completion_basis==="FINISHED_TITLE" && r.year===year))).length;
  };
  const liveGoalValue=(key:string|null,year:number|null)=>{
    let s=livePeriods.get(year);
    if(!s){s=computeStats(items,[],year,cours,snapshot.history);livePeriods.set(year,s);}
    const ids=periodIds(s);
    return items.filter(i=>matchesType(i,key) && ids.has(i.id) && (i.type==="film" || i.watched || finished.has(work(i)))).length;
  };
  return {achievements,goalValue,liveGoalValue,get stats(){return getStrictStats();}};
}
