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
      {/* Life Compass */}
      <LifeCompass
        goals={goals}
        activeCategory={activeCategory}
        onCategoryClick={onCategoryClick}
      />

      {/* Focus Goal */}
      {focusGoal && (
        <button
          type="button"
          onClick={() => router.push(`/life/goals/${focusGoal.id}`)}
          className="w-full text-left relative overflow-hidden rounded-lg border border-border-subtle bg-surface-1 p-3 cursor-pointer transition-colors duration-100 hover:bg-surface-2"
        >
          <h3 className="mb-2 text-xs font-semibold text-text-secondary">
            Focus
          </h3>
          <p className="text-xs font-medium mb-3 line-clamp-2 leading-snug" style={{ color: "var(--color-text-secondary)" }}>
            {focusGoal.title}
          </p>
          <div className="flex items-center gap-2 mb-2">
            <div className="flex-1 h-1 rounded-full bg-surface-2 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${focusGoal.progress}%`,
                  backgroundColor: ACCENT,
                }}
              />
            </div>
            <span className="text-xs font-medium text-text-primary shrink-0 tabular-nums">
              {focusGoal.progress}%
            </span>
          </div>
          {focusGoal.target_date && (
            <p className="text-xs text-text-tertiary">
              {new Date(focusGoal.target_date).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </p>
          )}
        </button>
      )}

      {/* Quick Stats */}
      <div className="relative overflow-hidden rounded-lg border border-border-subtle bg-surface-1 p-3">
        <h3 className="mb-2 text-xs font-semibold text-text-secondary">
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
