"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { STALE } from "@/shared/lib/stale";
import { WATCHING_KEYS } from "../../hooks/query-keys";
import { getRewatchCatalogue, getMediaHistory } from "../../service";
import { parseViewingInput } from "../../lib/viewing-history";
import { formatHistoryDate, rangeCount, frozenMinutes, frozenKnownMinutes } from "../../lib/history-analytics";
import { parseEpisodeRanges, type RewatchRequest, type RewatchCatalogue, type RewatchScope } from "../../lib/rewatch";
import type { WatchingMedia } from "../../types";
import type { MediaView } from "../../lib/media-view";
export function RewatchForm({media,view,date,replaces,pending,onSave,onClose}: {
  media:WatchingMedia;view:MediaView;date:string;replaces?:string;pending:boolean;
  onSave:(request:RewatchRequest,catalogue:RewatchCatalogue)=>Promise<void>;onClose:()=>void;
}) {
  const cache=useQueryClient();
  const [when,setWhen]=useState(date),[scope,setScope]=useState(media.type==="film" ? "WHOLE_TITLE" : ""),[number,setNumber]=useState(1),[ranges,setRanges]=useState(""),[error,setError]=useState("");
  const context=useQuery({queryKey:[...WATCHING_KEYS.all,"rewatch-context",media.id],queryFn:()=>getRewatchCatalogue(media.type==="film" ? null : media.tmdb_id),staleTime:STALE.MINUTE,gcTime:STALE.HOUR});
  const c=context.data;
  const matches=!!c && !view.pending && (view.overlaid ? c.cours.length===(view.cours?.length ?? 0) && (view.cours ?? []).every(cour => c.cours.some(current => current.id===cour.anilist_id && current.number===cour.season && current.start===cour.start_episode && current.end===cour.end_episode))
    : c.seasons.every(s => s.aired==null || s.aired===view.seasons[s.number-1]?.aired));
  const submit=async () => {
    setError("");
    try {
      if (!c || !matches || !scope) throw new Error("Refresh and choose the rewatch scope");
      const selection:RewatchScope={kind:scope as RewatchScope["kind"],number,courId:view.cours?.[number-1]?.anilist_id,
        ...(scope==="EPISODES" ? {ranges:parseEpisodeRanges(ranges)} : {})};
      await onSave({date:when ? parseViewingInput(when) : null,scope:selection,replaces},c);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not record rewatch"); }
  };
  const input="min-w-0 w-full rounded-control border border-border-subtle bg-surface-2 px-2 py-2 text-sm text-text-primary";
  return <div className="mt-3 space-y-2 rounded-card bg-surface-1 p-3">
    <p className="text-sm font-medium text-text-primary">{replaces ? "Correct rewatch" : "Record rewatch"}</p>
    {media.type!=="film" && <label className="block text-xs text-text-secondary">What did you rewatch?
      <select aria-label="Rewatch scope" className={input} value={scope} onChange={e=>setScope(e.target.value)}>
        <option value="">Choose scope</option><option value="WHOLE_TITLE">Whole title (available episodes)</option><option value="SEASON">Original season</option>
        {view.overlaid && <option value="COUR">Cour</option>}<option value="EPISODES">Specific episodes</option>
      </select></label>}
    {media.type==="film" && <p className="text-xs text-text-secondary">Whole movie</p>}
    {(scope==="SEASON" || scope==="COUR") && <label className="block text-xs text-text-secondary">{scope==="COUR" ? "Cour number" : "Original season number"}<input aria-label="Scope number" className={input} type="number" min={1} value={number} onChange={e=>setNumber(Number(e.target.value))}/></label>}
    {scope==="EPISODES" && <label className="block text-xs text-text-secondary">Original season episode ranges (S1:4-8, S2:1-3)<input aria-label="Episode ranges" className={input} value={ranges} onChange={e=>setRanges(e.target.value)}/></label>}
    <label className="block text-xs text-text-secondary">Date: YYYY, YYYY-MM or YYYY-MM-DD. Leave blank if unknown.<input aria-label="Rewatch date" className={input} value={when} onChange={e=>setWhen(e.target.value)}/></label>
    {!matches && <button type="button" className="text-xs text-text-primary underline" onClick={()=>{void cache.invalidateQueries({queryKey:WATCHING_KEYS.all});}}>Refresh viewing details</button>}
    {error && <p role="alert" className="text-xs text-red-400">{error}</p>}
    <div className="flex gap-2"><button type="button" className="rounded-control bg-surface-3 px-3 py-2 text-xs text-text-primary disabled:opacity-40" disabled={pending || !matches || !scope} onClick={()=>{void submit();}}>Record rewatch</button><button type="button" className="px-2 text-xs text-text-secondary" onClick={onClose}>Cancel</button></div>
  </div>;
}
export function ViewingHistory({mediaId}:{mediaId:string}) {
  const [open,setOpen]=useState(false);
  const {data,error}=useQuery({queryKey:[...WATCHING_KEYS.all,"viewing-history",mediaId],queryFn:()=>getMediaHistory(mediaId),enabled:open,staleTime:STALE.MINUTE,gcTime:STALE.HOUR});
  return <div className="mt-3"><button type="button" className="text-xs text-white/70" aria-expanded={open} onClick={()=>setOpen(!open)}>Viewing history</button>
    {open && <div className="mt-2 max-h-64 space-y-2 overflow-y-auto text-xs text-white/70">{error ? <p>Could not load history.</p> : !data ? <p>Loading history...</p> : !data.records.length ? <p>No recorded viewing events. Legacy dates and scope have not been reconstructed.</p> : data.records.map(r => <div key={r.id} className="rounded-control bg-white/5 p-2">
      <p>{r.kind.replaceAll("_"," ")} / {formatHistoryDate(r)}{r.retracted_at ? " / Retracted" : ""}</p><p>{r.scope_kind} / {rangeCount(r.ranges) ?? "Unknown"} episodes / {r.kind==="COMPLETION" ? "Completion milestone (no additional time)" : frozenMinutes(r.ranges)==null ? frozenKnownMinutes(r.ranges)==null ? "Duration unknown" : `${frozenKnownMinutes(r.ranges)} known min; total duration unknown` : `${frozenMinutes(r.ranges)} min`}</p>
      {r.ranges.map((range,i)=><p key={i}>Season {range.season_number_at_recording}: {range.episode_from}-{range.episode_to}</p>)}
    </div>)}
      {(data?.ratings.length ?? 0)>0 && <><p className="font-medium">Rating assertions (recording dates)</p>{data!.ratings.map(r=><div key={r.id} className="rounded-control bg-white/5 p-2"><p>{r.score==null ? "Rating cleared" : `Rating: ${r.score} / 10`}</p><p>{r.scope_kind==="COUR" ? "Cour" : "Season"} {r.scope_number_at_recording} (recorded) / {r.episode_ids?.length ?? "Unknown"} episodes</p><p>Recorded {new Date(r.recorded_at).toLocaleDateString("en-GB")}</p></div>)}</>}
    </div>}
  </div>;
}
