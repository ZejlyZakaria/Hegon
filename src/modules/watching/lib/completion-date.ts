import { buildWatchedAtProjection, type WatchDateParts } from "./watched-date";
import { positionCoverage, type HistoryFacts, type HistoryMetadata, type StoredViewingAssertion } from "./viewing-history";

/** Only accepted consumption of the terminal episode can date a previously undated finish.
 * recorded_at is ordering evidence, never the date the owner watched something. */
function terminalEvidence(after:HistoryFacts,active:StoredViewingAssertion[],kind:"FIRST_WATCH"|"COMPLETION") {
  const terminal=positionCoverage(after).at(-1);
  if(!terminal) return undefined;
  const last=(after.season_aired ?? []).findLastIndex(n=>n>0);
  if(last<0 || terminal.season_number_at_recording!==last+1 || terminal.episode_to!==after.season_aired![last]) return undefined;
  const candidates=active.filter(r=>r.kind===kind && (kind!=="COMPLETION" || r.completion_basis==="FINISHED_TITLE") &&
    r.date_confidence==="CONFIRMED" && r.year!=null && ["USER_ACTION","USER_CORRECTION"].includes(r.origin) &&
    r.ranges.some(range=>range.season_number_at_recording===terminal.season_number_at_recording &&
      range.episode_from<=terminal.episode_to && range.episode_to>=terminal.episode_to));
  candidates.sort((a,b)=>(a.recorded_at ?? "").localeCompare(b.recorded_at ?? "") || a.id.localeCompare(b.id));
  // First consumption counts once; later full-title completions may describe a grown title.
  const record=kind==="FIRST_WATCH" ? candidates[0]:candidates.at(-1);
  return record ? {year:record.year!,month:record.month,day:record.day}:undefined;
}

/** One date projection at the existing atomic command boundary; no new status writer. */
export function completionDatePatch(before:HistoryFacts,patch:Record<string,unknown>,meta:HistoryMetadata,active:StoredViewingAssertion[]) {
  const after={...before,...patch} as HistoryFacts;
  if(after.type==="film" || !after.watched) return {patch,meta};
  const finishing=patch.watched===true && !before.watched;
  let date:WatchDateParts|null|undefined;
  if(finishing) {
    date=meta.history_date;
    if(date===undefined && meta.history_intent!=="correction") date=terminalEvidence(after,active,"FIRST_WATCH");
  } else if("watched_at" in patch && meta.history_date===undefined) {
    // Editing an old season's year cannot erase a dated canonical full-title completion.
    date=terminalEvidence(after,active,"COMPLETION");
  }
  if(date===undefined) return {patch,meta};
  return {patch:{...patch,watched_at:date ? buildWatchedAtProjection(date):null},
    meta:finishing ? {...meta,history_date:date}:meta};
}

/** The completed period includes its accepted finish projection; season stamps retain their own years. */
export function watchedPeriodLabel(media:{type:string;watched?:boolean;watched_at?:string|null},yearMap:Record<string,number>|null|undefined):string|null {
  const finish=media.watched_at ? Number(media.watched_at.slice(0,4)):null;
  if(media.type==="film") return finish ? String(finish):null;
  const years=Object.values(yearMap ?? {}).filter(y=>Number.isInteger(y) && y>0);
  if(media.watched && finish && Number.isInteger(finish)) years.push(finish);
  if(!years.length) return finish ? String(finish):null;
  const first=Math.min(...years),last=Math.max(...years);
  return first===last ? String(first):`${first} – ${last}`;
}
