"use client";

import { useRouter } from "next/navigation";
import { Target, Check } from "lucide-react";
import { useWatchingGoals } from "../../hooks/useWatchingGoals";
import { goalMatchesMedia, goalCount } from "../../lib/goal-contribution";
import type { WatchingMedia } from "../../types";

// Goals accent (cross-module colour cue — you see this is a Goal, not a Watching thing).
const GOALS_ACCENT = "var(--color-accent-goals)";

// Shown on a WATCHED film's detail page: the watching-metric goals this title
// actually counted toward (type + period match). Hidden otherwise. This is the
// "the threads that connect everything" moment, made tangible per-title.
export function ContributingToGoals({ media }: { media: WatchingMedia }) {
  const router = useRouter();
  const { data: goals = [] } = useWatchingGoals(!!media.watched);

  if (!media.watched) return null;
  const matching = goals.filter((g) => goalMatchesMedia(g, { type: media.type, watched_at: media.watched_at ?? null }));
  if (matching.length === 0) return null;

  return (
    <div className="rounded-2xl bg-surface-1 p-4">
      <h2 className="mb-3 text-sm font-semibold text-text-primary">Contributing to</h2>
      <div className="space-y-2">
        {matching.map((g) => {
          const target = g.metric_target ?? 0;
          const count = goalCount(g);
          return (
            <button
              key={g.id}
              type="button"
              onClick={() => router.push(`/life/goals/${g.id}`)}
              className="group flex w-full cursor-pointer items-center gap-3 rounded-xl border border-border-subtle bg-surface-2/40 px-3 py-2.5 text-left transition-colors hover:bg-surface-2"
            >
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                style={{ backgroundColor: `color-mix(in srgb, ${GOALS_ACCENT} 16%, transparent)`, color: GOALS_ACCENT }}
              >
                <Target size={15} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-text-primary">{g.title}</p>
                <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-surface-3">
                  <div className="h-full rounded-full" style={{ width: `${g.progress}%`, backgroundColor: GOALS_ACCENT }} />
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <span className="text-xs tabular-nums text-text-secondary">{count}/{target}</span>
                <Check size={14} style={{ color: GOALS_ACCENT }} />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
