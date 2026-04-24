"use client";

import { useRouter } from "next/navigation";
import { LifeCompass } from "./LifeCompass";
import type { Goal, GoalCategory } from "../types";

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

  const focusGoal =
    goals.find((g) => g.status === "active" && g.target_date) ??
    goals.find((g) => g.status === "active");

  const active = goals.filter((g) => g.status === "active").length;
  const completed = goals.filter((g) => g.status === "completed").length;
  const overdue = goals.filter(
    (g) =>
      g.status === "active" &&
      g.target_date &&
      new Date(g.target_date) < new Date(),
  ).length;

  return (
    <div className="space-y-4">
      {/* Life Compass */}
      <LifeCompass
        goals={goals}
        activeCategory={activeCategory}
        onCategoryClick={onCategoryClick}
      />

      {/* Focus Goal */}
      {focusGoal && (
        <div
          onClick={() => router.push(`/life/goals/${focusGoal.id}`)}
          className="relative overflow-hidden rounded-lg border border-white/4 bg-[#0e0e10] p-3 cursor-pointer transition-colors duration-100 hover:bg-[#141416]"
        >
          <h3 className="mb-2 text-xs font-semibold text-text-secondary">
            Focus
          </h3>
          <p className="text-xs font-medium mb-3 line-clamp-2 leading-snug" style={{ color: "var(--color-text-secondary)" }}>
            {focusGoal.title}
          </p>
          <div className="flex items-center gap-2 mb-2">
            <div className="flex-1 h-1 rounded-full bg-[#141416] overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${focusGoal.progress}%`,
                  backgroundColor: ACCENT,
                }}
              />
            </div>
            <span className="text-xs font-medium text-[#e2e2e6] shrink-0 tabular-nums">
              {focusGoal.progress}%
            </span>
          </div>
          {focusGoal.target_date && (
            <p className="text-xs text-[#71717a]">
              {new Date(focusGoal.target_date).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </p>
          )}
        </div>
      )}

      {/* Quick Stats */}
      <div className="relative overflow-hidden rounded-lg border border-white/4 bg-[#0e0e10] p-3">
        <h3 className="mb-2 text-xs font-semibold text-text-secondary">
          Stats
        </h3>
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#a0a0a8]">Active</span>
            <span className="text-sm font-medium text-[#e2e2e6] tabular-nums">
              {active}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#a0a0a8]">Completed</span>
            <span className="text-sm font-medium text-[#e2e2e6] tabular-nums">
              {completed}
            </span>
          </div>
          {overdue > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#a0a0a8]">Overdue</span>
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
