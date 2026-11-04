"use client";

import { hasViewingEngagement } from "../../lib/series-state";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Target, Check } from "lucide-react";
import { SectionHeader } from "@/shared/components/ui/section-header";
import { useWatchingGoals } from "../../hooks/useWatchingGoals";
import { createLiveGoalEvaluator } from "../../lib/live-goal-metrics";
import { useMediaHistory } from "../../hooks/useMediaHistory";
import type { MediaView } from "../../lib/media-view";
import type { StatsRawItem } from "../../service";
import type { AnimeCoursRow } from "../../types";
import type { WatchingMedia } from "../../types";

// Goals accent (cross-module colour cue — you see this is a Goal, not a Watching thing).
const GOALS_ACCENT = "var(--color-accent-goals)";

// Explain membership in the same live metric as Goals, using accepted consumption periods.
export function ContributingToGoals({ media, view }: { media: WatchingMedia; view?: MediaView|null }) {
  const router = useRouter();
  const engaged=hasViewingEngagement(media);
  const { data: goals = [] } = useWatchingGoals(engaged);
  const history=useMediaHistory(media.id,engaged);
  const contribution=useMemo(()=>{
    const cours=new Map<number,AnimeCoursRow>();
    if(media.tmdb_id && view?.cours) cours.set(media.tmdb_id,{tmdb_id:media.tmdb_id,source:"anilist",cours:view.cours});
    return createLiveGoalEvaluator([media as StatsRawItem],cours,{records:history.data?.records ?? [],ratings:[]});
  },[media,view,history.data]);
  if (!engaged || history.isPending || history.error) return null;
  const matching=goals.filter(g=>contribution(g.metric_key,g.metric_period==="year" ? g.metric_year:null)>0);
  if (matching.length === 0) return null;

  // No panel: each goal row is already its own bordered card — a panel around them would be
  // a box of boxes.
  return (
    <section>
      <SectionHeader title="Contributing to" />
      <div className="space-y-2">
        {matching.map((g) => {
          const target = g.metric_target ?? 0;
          const count  = g.metric_current;
          const pct = target > 0 ? Math.max(0,Math.min(100,(count/target)*100)) : Math.max(0,Math.min(100,g.progress));
          const complete=target>0 && count>=target;
          return (
            <button
              key={g.id}
              type="button"
              onClick={() => router.push(`/life/goals/${g.id}`)}
              className="group flex w-full cursor-pointer items-center gap-3 rounded-card border border-border-subtle bg-surface-2/40 px-3 py-2.5 text-left transition-colors hover:bg-surface-2"
            >
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control"
                style={{ backgroundColor: `color-mix(in srgb, ${GOALS_ACCENT} 16%, transparent)`, color: GOALS_ACCENT }}
              >
                <Target size={15} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-text-primary">{g.title}</p>
                <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-surface-3">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: GOALS_ACCENT }} />
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <span className="text-xs tabular-nums text-text-secondary">{count}/{target}</span>
                {complete && <Check size={14} aria-label="Target reached" style={{ color: GOALS_ACCENT }} />}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
