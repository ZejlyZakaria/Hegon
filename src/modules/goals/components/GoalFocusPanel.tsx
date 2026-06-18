"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { LifeCompass } from "./LifeCompass";
import type { Goal, GoalCategory, GoalPriority } from "../types";

const PRIORITY_RANK: Record<GoalPriority, number> = { critical: 0, high: 1, medium: 2, low: 3 };

const ACCENT = "var(--color-accent-goals)";

interface Props {
  goals: Goal[];
  activeCategory: GoalCategory | null;
  onCategoryClick: (cat: GoalCategory | null) => void;
}

export function GoalRightPanel({
  goals,
  activeCategory,
  onCategoryClick,
}: Props) {
  const router = useRouter();

  const focusGoal = useMemo(() => {
    const active = goals.filter((g) => g.status === "active");
    return (
      active.sort((a, b) => {
        if (a.target_date && b.target_date)
          return a.target_date.localeCompare(b.target_date);
        if (a.target_date) return -1;
        if (b.target_date) return 1;
        return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
      })[0] ?? null
    );
  }, [goals]);

  const active = goals.filter((g) => g.status === "active").length;
  const completed = goals.filter((g) => g.status === "completed").length;
  const overdue = goals.filter(
    (g) =>
      g.status === "active" &&
      g.target_date &&
      new Date(g.target_date) < new Date(),
  ).length;

  return (
    <div className="space-y-3">
      {/* Focus Goal — the module's branded hero card (deep-green solid surface).
          First in the rail by design: it's the single most actionable goal. */}
      {focusGoal && (
        <button
          type="button"
          onClick={() => router.push(`/life/goals/${focusGoal.id}`)}
          className="relative w-full cursor-pointer overflow-hidden rounded-card p-3.5 text-left transition-transform duration-200 ease-out hover:scale-[1.01]"
          style={{
            background: "var(--color-accent-goals-deep)",
            boxShadow:
              "inset 0 1px 0 0 rgba(255,255,255,0.08), inset 0 0 0 1px rgba(255,255,255,0.06), 0 1px 2px 0 rgba(0,0,0,0.35), 0 10px 30px -12px rgba(0,0,0,0.5)",
          }}
        >
          <div className="mb-3 flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: ACCENT }} />
            <h3 className="text-xs font-semibold" style={{ color: "#86efac" }}>
              Focus
            </h3>
          </div>
          <p className="mb-3 line-clamp-2 text-sm font-semibold leading-snug text-white">
            {focusGoal.title}
          </p>
          <div className="mb-2 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/30">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${focusGoal.progress}%`, backgroundColor: ACCENT }}
              />
            </div>
            <span className="shrink-0 text-xs font-semibold tabular-nums text-white">
              {focusGoal.progress}%
            </span>
          </div>
          {focusGoal.target_date && (
            <p className="text-xs text-white/55">
              {new Date(focusGoal.target_date).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </p>
          )}
        </button>
      )}

      {/* Life Compass */}
      <LifeCompass
        goals={goals}
        activeCategory={activeCategory}
        onCategoryClick={onCategoryClick}
      />

      {/* Quick Stats */}
      <div className="surface-card relative overflow-hidden rounded-card p-3">
        <h3 className="mb-3 text-xs font-semibold text-text-secondary">
          Stats
        </h3>
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-secondary">Active</span>
            <span className="text-sm font-medium text-text-primary tabular-nums">
              {active}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-secondary">Completed</span>
            <span className="text-sm font-medium text-text-primary tabular-nums">
              {completed}
            </span>
          </div>
          {overdue > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-secondary">Overdue</span>
              <span className="text-sm font-medium tabular-nums" style={{ color: "#f87171" }}>
                {overdue}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
