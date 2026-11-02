import {buildMediaView} from "./media-view";
import {legacyCoordinates,seasonContributions} from "./legacy-consumption";
import type {StatsRawItem} from "../service";
import {deduplicateFirstViewing, historicalContributions, frozenMinutes, legacyViewingDate, type HistoricalViewing} from "./history-analytics";
import type {MediaView} from "./media-view";
import {viewingDate, type ViewingDate, type ViewingRange} from "./viewing-history";
import type {Rewatch, WatchingMedia} from "../types";

export interface ViewingEpisodeRange {season:number;from:number;to:number}
export interface RewatchSummary {
  id:string;date:ViewingDate;scope:string;minutes:number|null;inferred:boolean;rewatch?:Rewatch;
}

type TimelineMedia=Pick<WatchingMedia,"id"|"type"|"watched"|"watched_at"|"viewing_date">;

export function timelineDate(date:ViewingDate):string {
  if(date.year==null) return "Date not set";
  if(date.month==null) return String(date.year);
  const d=new Date(Date.UTC(date.year,date.month-1,date.day ?? 1));
  return new Intl.DateTimeFormat("en-GB",{year:"numeric",month:"short",...(date.day!=null ? {day:"numeric" as const}:{}),timeZone:"UTC"}).format(d);
}
export function timelineDuration(minutes:number):string {
  const rounded=Math.round(minutes),hours=Math.floor(rounded/60),rest=rounded%60;
  return hours ? `${hours}h${rest ? ` ${rest}m`:""}`:`${rest}m`;
}
const sortedRanges=(ranges:ViewingRange[])=>[...ranges].sort((a,b)=>a.season_number_at_recording-b.season_number_at_recording || a.episode_from-b.episode_from);
function displayRanges(ranges:ViewingRange[],view?:MediaView|null):ViewingEpisodeRange[] {
  if(!view?.overlaid || view.pending) return sortedRanges(ranges).map(r=>({season:r.season_number_at_recording,from:r.episode_from,to:r.episode_to}));
  const displayed:ViewingEpisodeRange[]=[];
  for(const range of sortedRanges(ranges)) for(let ep=range.episode_from;ep<=range.episode_to;ep++) {
    const p=view.fromStorage(range.season_number_at_recording,ep),last=displayed.at(-1);
    if(last && last.season===p.season && last.to+1===p.episode) last.to=p.episode;
    else displayed.push({season:p.season,from:p.episode,to:p.episode});
  }
  return displayed;
}
const interval=(from:number,to:number)=>from===to ? `EP${from}`:`EP${from}–${to}`;
function scopeLabel(media:TimelineMedia,record:Pick<HistoricalViewing,"scope_kind"|"scope_key"|"ranges">,view?:MediaView|null):string {
  if(media.type==="film") return "Entire film";
  if(record.scope_kind==="WHOLE_TITLE") return "Entire series";
  if(record.scope_kind==="COUR" && view && !view.pending) {
    const part=view.seasons.flatMap(s=>(s.parts ?? []).map(p=>({season:s.season,...p}))).find(p=>record.scope_key===`anilist-cour:${p.id}`);
    if(part) return `Season ${part.season} · Part ${part.number}`;
    const cour=view.cours?.find(c=>record.scope_key===`anilist-cour:${c.anilist_id}`);
    if(cour) return `Season ${cour.season}`;
  }
  const ranges=displayRanges(record.ranges,view);
  if(!ranges.length) return "Viewing details not set";
  if(ranges.length>2) return `${new Set(ranges.map(r=>r.season)).size} seasons`;
  return ranges.map(r=>`Season ${r.season} · ${interval(r.from,r.to)}`).join(" / ");
}
export interface ViewingScopeSummary {
  id:string;label:string;period:string;minutes:number|null;unknownDuration:boolean;
  episodes:number;children:ViewingScopeSummary[];
}
export interface ViewingSummary {
  first:ViewingScopeSummary|null;rewatches:RewatchSummary[];hasParts:boolean;firstCoverage:ViewingRange[];
  finish:ViewingDate|null;
}

/** Presentation of the same accepted consumption ledger used by Stats. No new viewing facts. */
export function buildViewingSummary(media:WatchingMedia,records:HistoricalViewing[],rewatches:Rewatch[]=[],view?:MediaView|null):ViewingSummary {
  const lens=view ?? buildMediaView(media,null);
  const item:StatsRawItem={...media,season_episodes:media.season_episodes ?? null,season_aired:media.season_aired ?? null,
    episodes:media.episodes ?? null,current_season:media.current_season ?? null,current_episode:media.current_episode ?? null,
    directors:null,season_years:media.season_years ?? null,season_ratings:media.season_ratings ?? null,
    season_posters:media.season_posters ?? null,season_end_dates:media.season_end_dates ?? null,
    cour_years:media.cour_years ?? null,cour_ratings:media.cour_ratings ?? null,status:media.status ?? null,caught_up_at:media.caught_up_at ?? null};
  const active=deduplicateFirstViewing(records);
  const legacyLens=legacyCoordinates(item,lens);
  const ledger=historicalContributions(item,lens,{records:active,ratings:[]},seasonContributions(lens,item)).filter(c=>!c.rewatch);
  type Piece={range:ViewingRange;date:ViewingDate;source:string};
  const pieces:Piece[]=ledger.flatMap(c=>(c.ranges ?? []).map(range=>({range,date:c,source:c.source})));
  const period=(dates:ViewingDate[])=>{
    const known=dates.filter(d=>d.year!=null);
    if(!known.length) return "Date to confirm";
    const years=[...new Set(known.map(d=>d.year!))].sort((a,b)=>a-b);
    if(years.length>1) return `${years[0]}–${years.at(-1)}${known.length<dates.length ? " · dates incomplete":""}`;
    if(known.length===dates.length && known.every(d=>JSON.stringify(datesOnly(d))===JSON.stringify(datesOnly(known[0])))) return timelineDate(known[0]);
    return `${years[0]}${known.length<dates.length ? " · dates incomplete":""}`;
  };
  const summarize=(id:string,label:string,selected:Piece[],children:ViewingScopeSummary[]=[],partial=false):ViewingScopeSummary=>{
    const known=selected.filter(p=>p.range.minutes!=null && p.range.duration_basis==="RUNTIME_SNAPSHOT");
    return {id,label,period:period(selected.map(p=>partial && p.source==="LEGACY" ? viewingDate():p.date)),
      minutes:known.length ? known.reduce((n,p)=>n+p.range.minutes!,0):null,
      unknownDuration:selected.some(p=>p.range.minutes==null || p.range.duration_basis!=="RUNTIME_SNAPSHOT"),
      episodes:selected.reduce((n,p)=>n+p.range.episode_to-p.range.episode_from+1,0),children};
  };
  // A frozen aggregate duration cannot be divided across an unrecorded boundary safely.
  const select=(season:number,from:number,to:number):Piece[]=>pieces.flatMap(p=>{
    const coordinates=Array.from({length:p.range.episode_to-p.range.episode_from+1},(_,i)=>p.range.episode_from+i);
    const kept=coordinates.filter(ep=>{const d=(p.source==="LEGACY" ? legacyLens:lens).fromStorage(p.range.season_number_at_recording,ep);return d.season===season && d.episode>=from && d.episode<=to;});
    if(!kept.length) return [];
    const whole=kept.length===coordinates.length;
    return [{...p,range:{...p.range,episode_from:kept[0],episode_to:kept.at(-1)!,
      minutes:whole ? p.range.minutes:p.source==="LEGACY" && p.range.minutes!=null ? p.range.minutes*kept.length/coordinates.length:null,
      duration_basis:whole || p.source==="LEGACY" ? p.range.duration_basis:"UNKNOWN"}}];
  });
  const seasons=lens.seasons.flatMap(s=>{
    const selected=select(s.season,1,Infinity);
    if(!selected.length) return [];
    const parts=(s.parts?.length ?? 0)>1 ? s.parts!.flatMap(p=>{
      const selected=select(s.season,p.from,p.to);
      return selected.length ? [summarize(`part:${p.id}`,`Part ${p.number} · EP${p.from}–${p.to}`,selected,[],true)]:[];
    }):[];
    return [summarize(`season:${s.season}`,`Season ${s.season}`,selected,parts)];
  });
  const first=ledger.length ? summarize("first","First viewing",pieces,seasons):null;
  if(first && !pieces.length) {first.period=period(ledger);first.unknownDuration=true;}
  const byRewatch=new Map(rewatches.map(r=>[r.id,r]));
  const entries:RewatchSummary[]=active.filter(r=>r.kind==="REWATCH" && !r.retracted_at).map(r=>{
    const rewatch=byRewatch.get(r.id);byRewatch.delete(r.id);
    return {id:r.id,date:r,scope:scopeLabel(media,r,lens),minutes:frozenMinutes(r.ranges),
      inferred:r.date_confidence==="INFERRED",rewatch};
  });
  const canonicalIds=new Set(records.filter(r=>r.kind==="REWATCH").map(r=>r.id));
  for(const r of byRewatch.values()) if(!canonicalIds.has(r.id)) entries.push({id:r.id,date:legacyViewingDate(r.watched_on),
    scope:media.type==="film" ? "Entire film":r.scope_known ? r.scope_label ?? "Selected seasons":"Scope to confirm",
    minutes:r.minutes ?? null,inferred:false,rewatch:r});
  entries.sort((a,b)=>dateRank(b.date)-dateRank(a.date)||a.id.localeCompare(b.id));
  const finish=active.filter(r=>!r.retracted_at && r.kind==="COMPLETION" && r.completion_basis==="FINISHED_TITLE" && r.date_confidence==="CONFIRMED" && r.year!=null)
    .sort((a,b)=>a.recorded_at.localeCompare(b.recorded_at)||a.id.localeCompare(b.id)).at(-1) ?? null;
  return {first,rewatches:entries,hasParts:seasons.some(s=>s.children.length>0),firstCoverage:pieces.map(p=>p.range),finish};
}
const datesOnly=(d:ViewingDate)=>[d.year,d.month,d.day];
const dateRank=(d:ViewingDate)=>d.year==null ? -1:d.year*10000+(d.month ?? 0)*100+(d.day ?? 0);

export function viewingPanelLabel(summary:ViewingSummary):string|null {
  if(summary.rewatches.length) return "Viewing history";
  return summary.first && summary.hasParts ? "Viewing details":null;
}

/** Totals preserve frozen scopes and expose incomplete duration instead of estimating it. */
export function viewingMetrics(summary: ViewingSummary) {
  const durations = [summary.first?.minutes, ...summary.rewatches.map(r => r.minutes)]
    .filter((n): n is number => n != null && Number.isFinite(n));
  return {
    episodes: summary.first && summary.firstCoverage.length ? summary.first.episodes : null,
    minutes: durations.length ? durations.reduce((sum, n) => sum + n, 0) : null,
    incomplete: !!summary.first?.unknownDuration || (!!summary.first && summary.first.minutes == null)
      || summary.rewatches.some(r => r.minutes == null),
  };
}
