import type { StatsRawItem } from "../service";
import type { MediaView } from "./media-view";
import { historicalRatingResult, rangeCount, workKeyOf, type HistoryAnalytics, type HistoricalRatingResult, type WatchContribution } from "./history-analytics";

/** Read-only provider proof for an existing global opinion; not a new rating or watch date. */
export interface GlobalRatingBasis {
  kind: "SEASON" | "COUR" | "WHOLE_TITLE"; key:string; number:number; score:number;
  ids:number[]; snapshot_id:string; mapping_snapshot_id:string|null;
  episodes:{season_number:number;episode:{id:number;number:number}}[];
}
export type GlobalRatingBases = Record<string,GlobalRatingBasis>;

/** A coordinate must have first-view evidence in this period; activity/rewatches cannot date an opinion. */
function coveredInYear(item:StatsRawItem,view:MediaView,ledger:WatchContribution[],year:number,season:number,episode:number):boolean {
  return ledger.some(c=>c.itemId===item.id && !c.rewatch && c.year===year && (
    c.ranges?.some(r=>r.season_number_at_recording===season && episode>=r.episode_from && episode<=r.episode_to)
    || !c.ranges?.length && c.displaySeasons?.some(n=>{
      const start=view.toStorage(n,1),end=view.toStorage(n,c.episodes ?? 0);
      return start.season===season && end.season===season && episode>=start.episode && episode<=end.episode;
    })
  ));
}

/** Shared annual rating selection. Unknown dates/scopes never borrow a global opinion. */
export function resolvePeriodRating(item:StatsRawItem,view:MediaView,year:number|null,history:HistoryAnalytics,ledger:WatchContribution[],basis?:GlobalRatingBasis):HistoricalRatingResult {
  if(year==null || item.type==="film")return {score:item.user_rating,scopes:[]};
  const first=ledger.filter(c=>c.itemId===item.id && !c.rewatch && c.year===year);
  if(!first.length)return {score:null,scopes:[]};
  const seasons=[...new Set(first.flatMap(c=>c.displaySeasons ?? []))];
  const votes=seasons.flatMap(number=>{
    const score=view.ratingMap?.[String(number)];
    return score==null ? []:[{kind:view.overlaid ? "COUR":"SEASON",number,score}];
  });
  const work=workKeyOf(item),byId=new Map(history.records.map(r=>[r.id,r]));
  // A whole-work opinion is usable only if ALL its frozen episodes belong to this year.
  const applicable={...history,ratings:history.ratings.filter(r=>r.scope_kind!=="WHOLE_TITLE" || r.work_key!==work || (()=>{
    let linked=r; const seen=new Set<string>();
    while(!linked.viewing_record_id && linked.previous_rating_id && !seen.has(linked.id)){seen.add(linked.id);const prior=history.ratings.find(p=>p.id===linked.previous_rating_id);if(!prior)break;linked=prior;}
    const completion=linked.viewing_record_id ? byId.get(linked.viewing_record_id):undefined;
    return !!completion && !completion.retracted_at && !!rangeCount(completion.ranges) && completion.ranges.every(range=>{
      for(let ep=range.episode_from;ep<=range.episode_to;ep++)if(!coveredInYear(item,view,ledger,year,range.season_number_at_recording,ep))return false;
      return true;
    });
  })())};
  const scoped=historicalRatingResult(item,applicable,year,votes.length ? votes.reduce((n,v)=>n+v.score,0)/votes.length:null,votes,undefined,undefined,ledger);
  // Any recorded lineage, including a clear/retraction, prevents a legacy fallback resurrecting it.
  if(scoped.score!=null || history.ratings.some(r=>r.work_key===work))return scoped;
  if(!basis || !basis.ids.length || basis.episodes.length!==basis.ids.length || basis.score!==item.user_rating
    || !basis.episodes.every(e=>coveredInYear(item,view,ledger,year,e.season_number,e.episode.number)))return scoped;
  return {score:basis.score,scopes:basis.kind==="WHOLE_TITLE" ? []:[{kind:basis.kind,number:basis.number,scopeKey:basis.key}]};
}
