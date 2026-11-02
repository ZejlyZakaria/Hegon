"use client";
import { Button } from "@/shared/components/ui/button";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { STALE } from "@/shared/lib/stale";
import { WATCHING_KEYS } from "../../hooks/query-keys";
import { getRewatchCatalogue } from "../../service";
import { parseViewingInput } from "../../lib/viewing-history";
import { formatHistoryDate, rangeCount, frozenMinutes, frozenKnownMinutes } from "../../lib/history-analytics";
import { buildRewatch, rewatchWithinCoverage, emptyCatalogue, type RewatchRequest, type RewatchCatalogue, type RewatchScope } from "../../lib/rewatch";
import { WatchDatePicker } from "../shared/WatchDatePicker";
import type { WatchingMedia, Rewatch } from "../../types";
import type { ViewingRange } from "../../lib/viewing-history";
import type { MediaView } from "../../lib/media-view";

export function RewatchForm({media,view,date,initial,firstCoverage,pending,onSave,onClose}: {
  media:WatchingMedia;view:MediaView;date:string;initial?:Rewatch;firstCoverage?:ViewingRange[];pending:boolean;
  onSave:(request:RewatchRequest,catalogue:RewatchCatalogue)=>Promise<void>;onClose:()=>void;
}) {
  const cache=useQueryClient();
  const [when,setWhen]=useState(date);
  const [scope,setScope]=useState(initial?.scope && initial.scope.kind!=="WHOLE_TITLE" ? "RECORDED" : "WHOLE_TITLE");
  const [selected,setSelected]=useState<number[]>([]);
  const [error,setError]=useState("");
  const context=useQuery({queryKey:[...WATCHING_KEYS.all,"rewatch-context",media.id,media.tmdb_id],queryFn:()=>getRewatchCatalogue(media.tmdb_id),enabled:media.type!=="film",staleTime:STALE.MINUTE,gcTime:STALE.HOUR});
  const c=media.type==="film" ? emptyCatalogue() : context.data;
  const matches=media.type==="film" || !!c && !view.pending && (view.overlaid
    ? c.cours.length===(view.cours?.length ?? 0) && (view.cours ?? []).every(cour=>c.cours.some(current=>current.id===cour.anilist_id && current.number===cour.season && current.start===cour.start_episode && current.end===cour.end_episode))
    : c.seasons.every(s=>s.aired==null || s.aired===view.seasons[s.number-1]?.aired));
  let preview:ReturnType<typeof buildRewatch>|undefined;
  let problem="";
  let request:RewatchRequest|undefined;
  try {
    let selection:RewatchScope={kind:"WHOLE_TITLE"};
    if (scope==="UNKNOWN") selection={kind:"UNKNOWN"};
    if (scope==="RECORDED" && initial?.scope) {
      selection=initial.scope;
      if(selection.kind==="COUR") selection={...selection,number:c?.cours.find(cour=>cour.id===selection.courId)?.number};
    }
    if (scope==="SEASONS") selection={kind:view.overlaid ? "COUR":"SEASON",selections:selected.map(number=>({number,courId:view.cours?.[number-1]?.anilist_id}))};
    request={date:when ? parseViewingInput(when):null,scope:selection,...(initial ? initial.canonical ? {replaces:initial.id}:{legacyId:initial.id}: {})};
    if(scope!=="UNKNOWN" && !matches) throw new Error(context.error ? "Could not load viewing details. Try again.":context.isPending ? "Loading viewing details…":"Viewing details changed. Refresh before saving.");
    preview=buildRewatch(media,request,c ?? emptyCatalogue());
    if(!initial && firstCoverage && !rewatchWithinCoverage(preview.ranges,firstCoverage)) {preview=undefined;problem="Choose seasons you have already watched. Unwatched episodes cannot be logged as a rewatch.";}
  } catch(e) {
    problem=e instanceof Error ? e.message:"Choose viewing details";
    if(media.type!=="film" && c && !c.seasons.length && problem.startsWith("Historical episode availability")) problem="Episode history has not been synced for this title yet. Check again after the series sync.";
  }
  const submit=async()=>{
    if(pending || !preview || !request) return;
    setError("");
    try {await onSave(request,c ?? emptyCatalogue());} catch(e) {setError(e instanceof Error ? e.message:"Could not record rewatch");}
  };
  const now=new Date();
  const picker=when ? (()=>{try{return parseViewingInput(when);}catch{return null;}})():null;
  const choice="min-h-11 h-auto sm:min-h-8 sm:pointer-coarse:min-h-11 sm:py-1.5";
  const active="border-accent-watching-vivid bg-accent-watching-vivid/10 text-text-primary";
  const inactive="border-border-subtle bg-surface-2 text-text-secondary";
  const minutes=preview ? frozenMinutes(preview.ranges):null;
  const episodes=preview ? rangeCount(preview.ranges):null;
  const known=preview ? frozenKnownMinutes(preview.ranges):null;
  return <div className="space-y-5" aria-label={initial ? "Correct rewatch":"Log rewatch"}>
    <div><p className="text-sm font-medium text-text-primary">{initial ? "Complete or correct rewatch":"Log rewatch"}</p>
      <p className="mt-1 text-xs leading-relaxed text-text-secondary">{initial && !initial.canonical ? "Confirm what you rewatched. Your original viewing progress stays unchanged.":"A separate viewing event. Your original progress and ratings stay unchanged."}</p></div>
    {media.type!=="film" && <fieldset className="space-y-2" disabled={pending}>
      <legend className="mb-2 text-xs font-medium text-text-secondary">What did you rewatch?</legend>
      <div className="flex flex-wrap gap-2">{[["WHOLE_TITLE","Entire show"],["SEASONS","Select seasons"],...(initial?.scope && initial.scope.kind!=="WHOLE_TITLE" ? [["RECORDED","Recorded selection"]]:[])].map(([value,label])=><Button size="sm" key={value} type="button" aria-pressed={scope===value} className={`${choice} ${scope===value ? active:inactive}`} onClick={()=>setScope(value)}>{label}</Button>)}</div>
      {scope==="SEASONS" && <div className="grid max-h-52 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3" aria-label="Seasons to rewatch">
        {view.seasons.map(s=>{
          let available:number|null=null;
          try {available=rangeCount(buildRewatch(media,{date:when ? parseViewingInput(when):null,scope:{kind:view.overlaid ? "COUR":"SEASON",number:s.season,courId:view.cours?.[s.season-1]?.anilist_id}},c ?? emptyCatalogue()).ranges);} catch { /* Availability is unknown or outside the chosen period. */ }
          return <Button size="sm" key={s.season} type="button" disabled={!available || !matches} aria-pressed={selected.includes(s.season)} className={`${choice} min-w-0 flex-col gap-1 whitespace-normal px-2 ${selected.includes(s.season) ? active:inactive}`} onClick={()=>setSelected(current=>current.includes(s.season) ? current.filter(n=>n!==s.season):[...current,s.season].sort((a,b)=>a-b))}><span>Season {s.season}</span><span className="text-xs text-text-tertiary">{available ? `${available} episodes`:"Unavailable in this period"}</span></Button>;
        })}
      </div>}
      <button type="button" aria-pressed={scope==="UNKNOWN"} className="min-h-11 sm:min-h-8 sm:pointer-coarse:min-h-11 text-xs text-text-secondary underline underline-offset-4" onClick={()=>setScope(scope==="UNKNOWN" ? "WHOLE_TITLE":"UNKNOWN")}>Partial rewatch / scope unsure</button>
    </fieldset>}
    <fieldset disabled={pending} className="space-y-2"><legend className="text-xs font-medium text-text-secondary">When did you rewatch it?</legend>
      {picker && <WatchDatePicker value={picker} minYear={Math.min(media.year || 1900,now.getFullYear())} onChange={parts=>setWhen(formatHistoryDate({...parts,date_precision:parts.month==null ? "YEAR":parts.day==null ? "MONTH":"DAY"}))}/>}
      <label className="flex min-h-11 cursor-pointer items-center gap-2 text-xs text-text-secondary"><input type="checkbox" checked={!when} disabled={pending} onChange={e=>setWhen(e.target.checked ? "":`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`)}/>Date unknown</label>
    </fieldset>
    <div aria-live="polite" className="space-y-1 rounded-control bg-surface-2 p-3 text-xs text-text-secondary">
      {preview ? <><p className="font-medium text-text-primary">{scope==="UNKNOWN" ? "Scope unknown":media.type==="film" ? "Entire movie":scope==="WHOLE_TITLE" ? "Entire show":scope==="RECORDED" ? "Recorded selection":selected.map(n=>`Season ${n}`).join(" + ")}{media.type!=="film" && episodes!=null ? ` · ${episodes} episodes`:""}{minutes!=null ? ` · ${Math.floor(minutes/60)}h ${minutes%60}m`:""}</p>
        {minutes==null && <p>{known!=null ? `${known} known minutes; remaining duration unknown.`:"Duration unknown; this event will not add estimated hours."}</p>}
        <p>{scope==="UNKNOWN" ? "Counts as one rewatch; episode count and total duration remain unknown.":media.type==="film" ? "This movie's duration is saved with the rewatch.":when ? "Includes only episodes available in your chosen period. Later releases cannot change this record.":"Includes episodes available today. The viewing date stays unknown."}</p>
        {media.type!=="film" && scope!=="UNKNOWN" && picker && picker.day==null && <p>Availability is checked up to the end of the selected {picker.month==null ? "year":"month"}, capped at today.</p>}</>:<p>{problem}</p>}
      {context.error || !matches || media.type!=="film" && c && !c.seasons.length ? <button type="button" className="min-h-11 underline underline-offset-4" onClick={()=>{void cache.invalidateQueries({queryKey:WATCHING_KEYS.all});}}>{c && !c.seasons.length ? "Check sync status":"Refresh viewing details"}</button>:null}
    </div>
    {error && <p role="alert" className="text-xs text-red-400">{error}</p>}
    <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border-subtle pt-3">
      <Button type="button" variant="subtle" size="sm" className="min-h-11 sm:min-h-8 sm:pointer-coarse:min-h-11" disabled={pending} onClick={onClose}>Cancel</Button>
      <Button type="button" variant="accent" size="sm" className="min-h-11 sm:min-h-8 sm:pointer-coarse:min-h-11" style={{"--btn-accent":"var(--color-accent-watching-vivid)"} as React.CSSProperties} disabled={pending || !preview} onClick={()=>{void submit();}}>{pending ? "Saving…":initial ? "Save correction":"Record rewatch"}</Button>
    </div>
  </div>;
}
