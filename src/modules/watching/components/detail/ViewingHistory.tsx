"use client";
import { BookOpen, MoreHorizontal, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/shared/components/ui/dropdown-menu";
import { timelineDate, timelineDuration, type ViewingSummary, type ViewingScopeSummary, type RewatchSummary } from "../../lib/viewing-timeline";
import type { Rewatch } from "../../types";

/** Personal viewings, not the internal assertion journal. Ordinary season details live on their posters. */
export function ViewingHistory({summary, title, poster, mediaType, loading,error,onEditRewatch,onRemoveRewatch,removing=false}:{
  summary:ViewingSummary;mediaType?:string;title?:string;poster?:string|null;loading:boolean;error:boolean;
  onEditRewatch:(rewatch:Rewatch)=>void;onRemoveRewatch:(id:string)=>void;removing?:boolean;
}) {
  if(error) return <p role="alert" className="text-sm text-text-secondary">Could not load viewing details. Close this panel and try again.</p>;
  if(loading) return <p role="status" className="text-sm text-text-secondary">Loading viewing details...</p>;
  return <div className="space-y-6 pb-1">
    <div className="flex items-center gap-4 rounded-card bg-surface-2 p-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {poster ? <img src={poster} alt="" className="h-24 w-16 shrink-0 rounded-control object-cover"/> : <span className="flex h-20 w-14 shrink-0 items-center justify-center rounded-control bg-surface-3 text-text-tertiary"><BookOpen size={24}/></span>}
      <div className="min-w-0"><p className="text-xs text-accent-watching-vivid">Your viewing journey</p><h3 className="mt-1.5 text-lg font-semibold leading-snug text-text-primary">{title ?? "Your viewings"}</h3><p className="mt-2 text-xs text-text-secondary">{summary.rewatches.length ? `${summary.rewatches.length} ${summary.rewatches.length === 1 ? "rewatch" : "rewatches"}` : "First viewing"}</p></div>
    </div>
    <section aria-label="First viewing">
      <div className="mb-4 flex items-center gap-2"><BookOpen size={15} className="text-accent-watching-vivid"/><h3 className="text-sm font-semibold text-text-primary">First viewing</h3></div>
      {summary.first ? <>
        <dl className={`grid grid-cols-2 gap-x-4 gap-y-4 rounded-card bg-surface-2 p-4 ${mediaType !== "film" && summary.firstCoverage.length > 0 ? "sm:grid-cols-[1.4fr_1fr_0.8fr]" : "sm:grid-cols-2"}`}>
          <div className="col-span-2 min-w-0 sm:col-span-1"><dt className="text-xs text-text-tertiary">Viewed</dt><dd className="mt-2 text-sm font-semibold leading-snug tabular-nums text-text-primary">{summary.first.period}</dd></div>
          <div><dt className="text-xs text-text-tertiary">{summary.first.unknownDuration ? "Known duration" : "Duration"}</dt><dd className="mt-2 text-sm font-semibold tabular-nums text-text-primary">{summary.first.minutes == null ? "Unconfirmed" : timelineDuration(summary.first.minutes)}</dd></div>
          {mediaType !== "film" && summary.firstCoverage.length > 0 && <div><dt className="text-xs text-text-tertiary">Episodes</dt><dd className="mt-2 text-sm font-semibold tabular-nums text-text-primary">{summary.first.episodes}</dd></div>}
        </dl>
        {summary.hasParts && <div className="mt-4"><SeasonBreakdown seasons={summary.first.children}/></div>}
      </> : <p className="text-sm text-text-secondary">First viewing details to confirm.</p>}
    </section>
    {summary.rewatches.length>0 && <section aria-label="Rewatches"><div className="mb-1 flex items-center justify-between"><h3 className="text-sm font-semibold text-text-primary">Rewatches</h3><span className="text-xs tabular-nums text-text-tertiary">{summary.rewatches.length}</span></div>
      <ol className="divide-y divide-border-subtle">{summary.rewatches.map(entry=><ViewingHistoryRow key={entry.id} entry={entry} removing={removing} onEditRewatch={onEditRewatch} onRemoveRewatch={onRemoveRewatch}/>)}</ol>
    </section>}
  </div>;
}

function SeasonBreakdown({seasons}:{seasons:ViewingScopeSummary[]}) {
  return <ul className="space-y-5">{seasons.map(s=><li key={s.id}>
    {s.children.length ? <div><div className="mb-2 flex items-baseline justify-between gap-3"><h4 className="text-sm font-semibold text-text-primary">{s.label}</h4><span className="text-xs text-text-tertiary">{s.children.length} parts</span></div>
      <ul className="divide-y divide-border-subtle">{s.children.map(p=><li key={p.id} className="py-3"><ScopeFact scope={p}/></li>)}</ul>
    </div>:<ScopeFact scope={s}/>}
  </li>)}</ul>;
}

function ScopeFact({scope}:{scope:ViewingScopeSummary}) {
  return <div className="flex items-start justify-between gap-4">
    <div className="min-w-0"><p className="text-sm font-medium text-text-primary">{scope.label}</p><p className="mt-1.5 text-xs leading-relaxed text-text-secondary">{scope.period}</p></div>
    <span className="shrink-0 pt-0.5 text-xs tabular-nums text-text-secondary">{scope.minutes==null ? "Unconfirmed":`${timelineDuration(scope.minutes)}${scope.unknownDuration ? " known":""}`}</span>
  </div>;
}

export function ViewingHistoryRow({entry,onEditRewatch,onRemoveRewatch,removing}:{
  entry:RewatchSummary;onEditRewatch:(rewatch:Rewatch)=>void;onRemoveRewatch:(id:string)=>void;removing:boolean;
}) {
  return <li className="flex items-start gap-3 py-4 sm:gap-4">
    <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-control bg-surface-2 text-accent-watching-vivid"><RotateCcw size={14}/></span>
    <div className="min-w-0 flex-1"><p className="text-sm font-medium text-text-primary">{timelineDate(entry.date)}</p>
      <p className="mt-1 text-xs text-text-secondary">{entry.scope}</p>
      {entry.inferred && <p className="mt-1 text-xs text-text-tertiary">Estimated date</p>}
    </div>
    <span className="pt-0.5 text-xs font-medium tabular-nums text-text-secondary">{entry.minutes == null ? "Unconfirmed" : timelineDuration(entry.minutes)}</span>
    {entry.rewatch && <DropdownMenu><DropdownMenuTrigger asChild><Button type="button" variant="subtle" size="icon-sm" className="min-h-11 min-w-11 sm:min-h-8 sm:min-w-8 sm:pointer-coarse:min-h-11 sm:pointer-coarse:min-w-11" aria-label={`Options for rewatch on ${timelineDate(entry.date)}`}><MoreHorizontal size={15}/></Button></DropdownMenuTrigger>
      <DropdownMenuContent align="end"><DropdownMenuItem disabled={removing} onClick={()=>onEditRewatch(entry.rewatch!)}><Pencil size={13}/>{entry.rewatch.canonical ? "Edit rewatch":"Complete details"}</DropdownMenuItem>
        <DropdownMenuItem disabled={removing} className="text-red-400 focus:text-red-400" onClick={()=>onRemoveRewatch(entry.id)}><Trash2 size={13}/>Remove rewatch</DropdownMenuItem></DropdownMenuContent>
    </DropdownMenu>}
  </li>;
}
