"use client";

import { useMemo } from "react";
import { Clock, Layers, RotateCcw } from "lucide-react";
import { Panel } from "@/shared/components/ui/panel";
import { useRewatches } from "../../hooks/useRewatches";
import { useMediaHistory } from "../../hooks/useMediaHistory";
import { buildViewingSummary, timelineDuration, viewingMetrics } from "../../lib/viewing-timeline";
import type { MediaView } from "../../lib/media-view";
import type { WatchingMedia } from "../../types";

/** Personal consumption only, from the same frozen ledger as viewing details. */
export function QuickStats({ media, view }: { media: WatchingMedia; view?: MediaView | null }) {
  const engaged = !!(media.watched || media.in_progress || media.paused || media.dropped);
  const history = useMediaHistory(media.id, engaged);
  const rewatches = useRewatches(media.id);
  const summary = useMemo(() => buildViewingSummary(media, history.data?.records ?? [], rewatches.data ?? [], view),
    [media, history.data, rewatches.data, view]);
  const metrics = viewingMetrics(summary);
  if (media.type === "film" || !engaged) return null;
  if (history.isPending || rewatches.isPending) return <Panel title="Quick Stats"><p role="status" className="text-xs text-text-tertiary">Loading viewing totals...</p></Panel>;
  if (history.error || rewatches.error) return <Panel title="Quick Stats"><p role="alert" className="text-xs text-text-secondary">Viewing totals are unavailable.</p></Panel>;
  if (!summary.first && !summary.rewatches.length) return null;
  return <Panel title="Quick Stats">
    <dl className="space-y-4">
      <div className="flex items-center justify-between gap-4"><dt className="flex items-center gap-2 text-xs text-text-secondary"><Layers size={14} className="text-text-tertiary"/>First-view episodes</dt><dd className="text-sm font-medium tabular-nums text-text-primary">{metrics.episodes ?? "Not confirmed"}</dd></div>
      <div className="flex items-center justify-between gap-4"><dt className="flex items-center gap-2 text-xs text-text-secondary"><Clock size={14} className="text-text-tertiary"/>{metrics.incomplete ? "Known watch time" : "Watch time"}</dt><dd className="text-sm font-medium tabular-nums text-text-primary">{metrics.minutes == null ? "Not confirmed" : timelineDuration(metrics.minutes)}</dd></div>
      {summary.rewatches.length > 0 && <div className="flex items-center justify-between gap-4"><dt className="flex items-center gap-2 text-xs text-text-secondary"><RotateCcw size={14} className="text-text-tertiary"/>Rewatches</dt><dd className="text-sm font-medium tabular-nums text-text-primary">{summary.rewatches.length}</dd></div>}
    </dl>
    {metrics.incomplete && <p className="mt-4 text-xs leading-relaxed text-text-tertiary">Some viewing durations are not confirmed.</p>}
    {!metrics.incomplete && summary.rewatches.length > 0 && <p className="mt-4 text-xs text-text-tertiary">Watch time includes recorded rewatches.</p>}
  </Panel>;
}
