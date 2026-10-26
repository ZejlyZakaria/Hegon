import { legacyRuntime, legacyCoordinates } from "./legacy-consumption";
import { parseViewingInput, viewingDate, type StoredViewingAssertion, type ViewingRange, type ViewingDate } from "./viewing-history";
import type { StatsRawItem } from "../service";
import type { MediaView } from "./media-view";
export interface HistoricalViewing extends Omit<StoredViewingAssertion,"origin"> {
  origin: StoredViewingAssertion["origin"] | "LEGACY_IMPORT" | "EXPLICIT_REPAIR";
  media_item_id: string | null; work_key: string; title_snapshot: string; media_type_snapshot: string;
  recorded_at: string; retracted_at: string | null; supersedes_id?: string;
}
export interface HistoricalRating {
  id: string; media_item_id: string | null; work_key: string; scope_kind: "SEASON" | "COUR"; scope_key: string;
  scope_number_at_recording: number; viewing_record_id: string | null; episode_ids: number[] | null;
  score: number | null; previous_rating_id: string | null; recorded_at: string;
}
export interface HistoryAnalytics { records: HistoricalViewing[]; ratings: HistoricalRating[] }
export interface WatchContribution extends ViewingDate {
  id: string; itemId: string; episodes: number | null; minutes: number | null; rewatch: boolean;
  source: "HISTORY" | "LEGACY"; scope: string;
  displaySeasons?: number[]; durationUnknown?: boolean;
  /** Stored title calendar fact, independent of a conflicting annual season attribution. */
  calendarDate?: ViewingDate;
}
export function periodMatches(date: ViewingDate, year: number | null, month?: number | null, day?: number | null): boolean {
  return (year==null || date.year===year) && (month==null || date.month===month) && (day==null || date.day===day);
}
export function formatHistoryDate(date: ViewingDate): string {
  if (date.year==null) return "Date unknown";
  const y=String(date.year).padStart(4,"0");
  return date.month==null ? y : date.day==null ? `${y}-${String(date.month).padStart(2,"0")}` : `${y}-${String(date.month).padStart(2,"0")}-${String(date.day).padStart(2,"0")}`;
}
export function rangeCount(ranges: ViewingRange[]): number | null {
  return ranges.length ? ranges.reduce((n,r) => n+r.episode_to-r.episode_from+1,0) : null;
}
export function frozenMinutes(ranges: ViewingRange[]): number | null {
  return ranges.length && ranges.every(r => r.minutes!=null && r.duration_basis!=="MILESTONE") ? ranges.reduce((n,r) => n+r.minutes!,0) : null;
}
export function frozenKnownMinutes(ranges:ViewingRange[]):number|null {
  const known=ranges.filter(r=>r.minutes!=null && r.duration_basis==="RUNTIME_SNAPSHOT");
  return known.length ? known.reduce((n,r)=>n+r.minutes!,0) : null;
}
export function workKeyOf(item: Pick<StatsRawItem,"id"|"tmdb_id"|"type">):string {
  if (item.id.startsWith("history:")) return item.id.slice("history:".length);
  return item.tmdb_id ? `${item.type==="film" ? "movie" : "tv"}:${item.tmdb_id}` : `local:${item.id}`;
}
export function recordsFor(item: StatsRawItem, history: HistoryAnalytics): HistoricalViewing[] {
  return history.records.filter(r => r.work_key===workKeyOf(item));
}
/** Shared receipt/Stats guard: first consumption is counted once; rewatches remain separate events. */
export function deduplicateFirstViewing(records:HistoricalViewing[]):HistoricalViewing[] {
  const firstSeen=new Set<string>();
  return [...new Map(records.map(r=>[r.id,r])).values()]
    .sort((a,b)=>a.recorded_at.localeCompare(b.recorded_at)||a.id.localeCompare(b.id)).flatMap(r=>{
      if(r.kind!=="FIRST_WATCH" || r.retracted_at || !r.ranges.length) return [r];
      const ranges=r.ranges.flatMap(range=>{
        const coordinates=Array.from({length:range.episode_to-range.episode_from+1},(_,i)=>range.episode_from+i);
        const fresh=coordinates.filter(ep=>!firstSeen.has(`${r.work_key}:${range.season_number_at_recording}:${ep}`));
        for(const ep of fresh) firstSeen.add(`${r.work_key}:${range.season_number_at_recording}:${ep}`);
        if(fresh.length===coordinates.length) return [range];
        // An aggregate runtime cannot safely be apportioned to a partially overlapping range.
        return fresh.map(ep=>({...range,episode_from:ep,episode_to:ep,episode_ids:null,minutes:null,duration_basis:"UNKNOWN" as const}));
      });
      return ranges.length ? [{...r,ranges}]:[];
    });
}
/** Owner accepts stored legacy calendar dates as-is, including pre-2024 dates. No timezone conversion. */
export function legacyViewingDate(value:string|null|undefined):ViewingDate {
  if (!value) return viewingDate();
  try { return viewingDate(parseViewingInput(value.slice(0,10))); }
  catch { return viewingDate(); }
}
/** A stable recorded cour identity wins over later catalogue offsets. */
function displaySeasonsFor(record:HistoricalViewing,view:MediaView):number[] {
  if(record.scope_kind==="COUR" && record.scope_key?.startsWith("anilist-cour:")) {
    const cour=view.cours?.find(c=>c.anilist_id===Number(record.scope_key!.slice("anilist-cour:".length)));
    return view.overlaid && cour ? [cour.season]:[];
  }
  return [...new Set(record.ranges.flatMap(range=>Array.from({length:range.episode_to-range.episode_from+1},(_,n)=>
    view.fromStorage(range.season_number_at_recording,range.episode_from+n).season)))];
}
/** History overrides only overlapping first-view coverage; version1 is never lifetime completeness. */
export function historicalContributions(item: StatsRawItem, view: MediaView, history: HistoryAnalytics,
  legacy: { episodes: number; year: number | null }[]): WatchContribution[] {
  const coordinates=legacyCoordinates(item,view),runtime=legacyRuntime(item);
  const records=recordsFor(item,history), first=records.filter(r => r.kind==="FIRST_WATCH");
  const out: WatchContribution[]=records.filter(r => !r.retracted_at && r.kind!=="COMPLETION").map(r => ({ ...r,
    id:r.id,itemId:item.id,episodes:rangeCount(r.ranges),minutes:frozenKnownMinutes(r.ranges),durationUnknown:frozenMinutes(r.ranges)==null,rewatch:r.kind==="REWATCH",source:"HISTORY",scope:r.scope_kind,displaySeasons:displaySeasonsFor(r,view) }));
  const addLegacy=(episodes:number, year:number|null, index:number) => {
    if (episodes<=0) return;
    const legacyDate=legacyViewingDate(item.watched_at);
    // A date belonging to scoped history cannot redate the unrelated legacy remainder,
    // even within the same year. Standalone explicit parts still describe their own projection.
    const parts=item.viewing_date;
    const belongsToHistory=parts && records.some(r=>r.year===parts.year && r.month===parts.month && r.day===parts.day);
    const stored=parts && !belongsToHistory && (legacyDate.year==null || parts.year===legacyDate.year)
      ? viewingDate(parts) : legacyDate;
    const date=stored.year===year ? stored : year==null ? viewingDate() : viewingDate({year,month:null,day:null});
    out.push({ id:`legacy:${item.id}:${index}`,itemId:item.id,...date,calendarDate:stored,
      episodes,minutes:runtime!=null && runtime>0 ? episodes*runtime : null,rewatch:false,source:"LEGACY",scope:"Legacy scope",displaySeasons:item.type==="film" ? []:[index+1] });
  };
  const represented=new Set<string>();
  const coordinate=(season:number,episode:number) => `${season}:${episode}`;
  // Include tombstones: intentional removal must not resurrect its legacy/completion projection.
  const firstRanges=first.flatMap(r=>r.ranges);
  const firstCovers=(season:number,episode:number) => firstRanges.some(r=>r.season_number_at_recording===season && r.episode_from<=episode && episode<=r.episode_to);
  if (item.type==="film") {
    if (!first.length && item.watched) {
      const year=item.watched_at ? Number(item.watched_at.slice(0,4)) : null;
      addLegacy(1,year,0);
      represented.add(coordinate(0,1));
    }
  } else if (item.watched || item.in_progress || item.paused || item.dropped) legacy.forEach((bucket,index) => {
    if (bucket.episodes<=0) return;
    const coarse=first.filter(r=>!r.ranges.length);
    const shadowed=coarse.some(r=>r.scope_kind==="WHOLE_TITLE" ||
      r.scope_kind==="SEASON" && !view.overlaid && r.scope_key===`tmdb-season:${index+1}` ||
      r.scope_kind==="COUR" && view.overlaid && (r.scope_key===`cour:${index+1}` || r.scope_key===`anilist-cour:${view.cours?.[index]?.anilist_id}`));
    if (shadowed) return;
    // Convert display contributions back to storage before matching frozen ranges.
    let count=0;
    for (let ep=1;ep<=bucket.episodes;ep++) {
      const position=coordinates.toStorage(index+1,ep);
      if (!firstCovers(position.season,position.episode)) {
        count++;
        represented.add(coordinate(position.season,position.episode));
      }
    }
    addLegacy(count,bucket.year,index);
  });
  // Completion is fallback evidence, not another watch. Never use today's runtime for a milestone.
  const completions=records.filter(r=>r.kind==="COMPLETION");
  const removed=completions.filter(r=>r.retracted_at).flatMap(r=>r.ranges);
  const coarseSeen=new Set<string>();
  for (const r of [...completions].sort((a,b)=>a.recorded_at.localeCompare(b.recorded_at)||a.id.localeCompare(b.id))) {
    if (r.retracted_at) continue;
    let episodes=0;
    for (const range of r.ranges) {
      if (!Number.isInteger(range.episode_from) || !Number.isInteger(range.episode_to) || range.episode_from<1 || range.episode_to<range.episode_from) continue;
      for (let ep=range.episode_from;ep<=range.episode_to;ep++) {
        const season=range.season_number_at_recording,key=coordinate(season,ep);
        if (firstCovers(season,ep) || represented.has(key) || removed.some(old=>old.season_number_at_recording===season && old.episode_from<=ep && ep<=old.episode_to)) continue;
        represented.add(key);episodes++;
      }
    }
    const coarseKey=`${r.scope_kind}:${r.scope_key ?? "unknown"}`;
    // A scope assertion without membership can retain a title, never a guessed episode count.
    const uncertain=!r.ranges.length && !first.length && !represented.size && !coarseSeen.has(coarseKey)
      && !completions.some(old=>old.retracted_at && old.scope_kind===r.scope_kind && old.scope_key===r.scope_key);
    if (!episodes && !uncertain) continue;
    coarseSeen.add(coarseKey);
    out.push({...r,id:r.id,itemId:item.id,episodes:episodes || null,minutes:null,durationUnknown:true,
      rewatch:false,source:"HISTORY",scope:r.scope_kind,displaySeasons:displaySeasonsFor(r,view)});
  }
  return out;
}
/** Latest assertion per scope and viewing-period context; previous assertions are history, not votes. */
export function historicalRating(item: StatsRawItem, history: HistoryAnalytics, year: number, fallback: number | null, legacyVotes: {kind:string; number:number; score:number}[] = [], month?:number, day?:number): number | null {
  const ratings=history.ratings.filter(r => r.work_key===workKeyOf(item));
  if (!ratings.length) return fallback;
  const records=recordsFor(item,history), byId=new Map(records.map(r => [r.id,r]));
  const votes=new Map<string,HistoricalRating>(), lineage=new Map(ratings.map(r=>[r.id,r]));
  const depth=(r:HistoricalRating) => {const seen=new Set<string>();let n=0;while(r.previous_rating_id && !seen.has(r.id)){seen.add(r.id);const previous=lineage.get(r.previous_rating_id);if(!previous)break;n++;r=previous;}return n;};
  for (const rating of [...ratings].sort((a,b) => depth(a)-depth(b)||a.recorded_at.localeCompare(b.recorded_at)||a.id.localeCompare(b.id))) {
    let linked=rating;
    const visited=new Set<string>();
    while (!linked.viewing_record_id && linked.previous_rating_id && !visited.has(linked.id)) {
      visited.add(linked.id);const previous=lineage.get(linked.previous_rating_id);if (!previous) break;linked=previous;
    }
    const completion=linked.viewing_record_id ? byId.get(linked.viewing_record_id) : undefined;
    if (!completion || completion.retracted_at || !linked.episode_ids?.length) continue;
    const terminal=[...completion.ranges].sort((a,b)=>a.season_number_at_recording-b.season_number_at_recording || a.episode_to-b.episode_to).at(-1);
    const dated=completion.year!=null ? completion : records.filter(r => !r.retracted_at && r.kind==="FIRST_WATCH" && r.year!=null && r.ranges.some(range =>
      terminal && range.season_number_at_recording===terminal.season_number_at_recording && range.episode_from<=terminal.episode_to && range.episode_to>=terminal.episode_to
      && (!range.episode_ids || range.episode_ids.includes(linked.episode_ids!.at(-1)!)))).sort((a,b) => b.recorded_at.localeCompare(a.recorded_at))[0];
    if (dated && periodMatches(dated,year,month,day)) votes.set(rating.scope_key,rating);
  }
  const scores=[...votes.values()].flatMap(r => r.score==null ? [] : [r.score]);
  scores.push(...legacyVotes.filter(v => !ratings.some(r => r.scope_kind===v.kind && r.scope_number_at_recording===v.number)).map(v => v.score));
  return scores.length ? scores.reduce((a,b) => a+b,0)/scores.length : null;
}

export interface CalendarStats {
  label:string; itemIds:string[]; events:number; titles:number; rewatches:number; episodes:number; knownMinutes:number;
  unknownDurationEvents:number; avgRating:number|null; ratedTitles:number;
}
/** Full calendar totals require actual components: YEAR never enters monthly/daily buckets. */
export function calendarStats(ledger:WatchContribution[],items:StatsRawItem[],history:HistoryAnalytics,precision:"YEAR"|"MONTH"|"DAY",year:number|null):CalendarStats[] {
  const groups=new Map<string,WatchContribution[]>(),byId=new Map(items.map(i=>[i.id,i]));
  for(const contribution of ledger){
    const date=precision==="YEAR" ? contribution : contribution.calendarDate ?? contribution;
    // Keep the stored calendar event, without relocating season-year episodes/hours to it.
    const c=date.year===contribution.year ? {...contribution,...date} : {...contribution,...date,episodes:null,minutes:null,durationUnknown:true};
    if(c.year==null || precision!=="YEAR" && c.month==null || precision==="DAY" && c.day==null || year!=null && c.year!==year)continue;
    const key=precision==="YEAR" ? String(c.year) : `${c.year}-${String(c.month).padStart(2,"0")}${precision==="DAY" ? `-${String(c.day).padStart(2,"0")}` : ""}`;
    const values=groups.get(key) ?? [];values.push(c);groups.set(key,values);
  }
  return [...groups].sort(([a],[b])=>a.localeCompare(b)).map(([label,rows])=>{
    const ids=new Set(rows.map(r=>r.itemId)),parts=label.split("-").map(Number);
    const ratings=[...ids].flatMap(id=>{const item=byId.get(id);if(!item || item.type==="film")return [];
      const score=historicalRating(item,history,parts[0],null,[],parts[1],parts[2]);return score==null ? []:[score];});
    return {label,itemIds:[...ids],events:new Set(rows.map(r=>r.rewatch ? r.id:r.itemId)).size,titles:ids.size,rewatches:rows.filter(c=>c.rewatch).length,
      episodes:rows.filter(c=>byId.get(c.itemId)?.type!=="film").reduce((n,c)=>n+(c.episodes ?? 0),0),
      knownMinutes:rows.reduce((n,c)=>n+(c.minutes ?? 0),0),unknownDurationEvents:rows.filter(c=>c.minutes==null || c.durationUnknown).length,
      avgRating:ratings.length ? ratings.reduce((a,b)=>a+b,0)/ratings.length : null,ratedTitles:ratings.length};
  });
}
