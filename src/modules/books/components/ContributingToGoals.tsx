"use client";

import { useRouter } from "next/navigation";
import { Target, Check } from "lucide-react";
import { useBooksGoals } from "../hooks/useBooksGoals";
import { goalMatchesBook } from "../lib/goal-contribution";
import type { Book } from "../types";

// Goals accent (cross-module colour cue — you read this as a Goal, not a Books thing).
const GOALS_ACCENT = "var(--color-accent-goals)";

// Shown on a READ book's detail page: the books-metric goals this book actually
// counted toward (period match). Hidden otherwise. The tangible "everything is
// connected" moment, per-book.
export function ContributingToGoals({ book }: { book: Book }) {
  const router = useRouter();
  const isRead = book.status === "read";
  const { data: goals = [] } = useBooksGoals(isRead);

  if (!isRead) return null;
  const matching = goals.filter((g) => goalMatchesBook(g, { finished_at: book.finished_at }));
  if (matching.length === 0) return null;

  return (
    <section className="mb-4">
      <h2 className="mb-2 text-xs font-semibold text-text-secondary">Contributing to</h2>
      <div className="space-y-2">
        {matching.map((g) => {
          const target = g.metric_target ?? 0;
          const count  = g.metric_current;
          const pct    = target > 0 ? Math.min(100, (count / target) * 100) : g.progress;
          return (
            <button
              key={g.id}
              type="button"
              onClick={() => router.push(`/life/goals/${g.id}`)}
              className="group flex w-full cursor-pointer items-center gap-3 rounded-card border border-border-subtle bg-surface-1 px-3 py-2.5 text-left transition-colors hover:bg-surface-2"
            >
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-tile"
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
                <Check size={14} style={{ color: GOALS_ACCENT }} />
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
