"use client";

import { useRouter } from "next/navigation";
import { LifeCompass } from "./LifeCompass";
import type { Goal, GoalCategory } from "../types";

const ACCENT = "#18ad9d";

interface Props {
  goals:           Goal[];
  activeCategory:  GoalCategory | null;
  onCategoryClick: (cat: GoalCategory | null) => void;
}

export function GoalFocusPanel({ goals, activeCategory, onCategoryClick }: Props) {
  const router = useRouter();

  const focusGoal =
    goals.find((g) => g.status === "active" && g.target_date) ??
    goals.find((g) => g.status === "active");

  const active    = goals.filter((g) => g.status === "active").length;
  const completed = goals.filter((g) => g.status === "completed").length;
  const overdue   = goals.filter(
    (g) => g.status === "active" && g.target_date && new Date(g.target_date) < new Date()
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
          className="relative overflow-hidden rounded-2xl border border-zinc-800/80 bg-linear-to-b from-zinc-900/80 to-zinc-900/60 backdrop-blur-sm p-4 cursor-pointer transition-all duration-200 hover:border-zinc-700/80"
        >
          <h3 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-3">
            Focus
          </h3>
          <p className="text-sm font-semibold text-zinc-200 mb-3 line-clamp-2 leading-snug">
            {focusGoal.title}
          </p>
          <div className="flex items-center gap-2 mb-2">
            <div className="flex-1 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${focusGoal.progress}%`, backgroundColor: ACCENT }}
              />
            </div>
            <span className="text-xs font-medium text-zinc-300 shrink-0 tabular-nums">
              {focusGoal.progress}%
            </span>
          </div>
          {focusGoal.target_date && (
            <p className="text-xs text-zinc-500">
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
      <div className="relative overflow-hidden rounded-2xl border border-zinc-800/80 bg-linear-to-b from-zinc-900/80 to-zinc-900/60 backdrop-blur-sm p-3">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-3">Stats</h3>
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-400">Active</span>
            <span className="text-sm font-semibold text-zinc-200 tabular-nums">{active}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-400">Completed</span>
            <span className="text-sm font-semibold text-zinc-200 tabular-nums">{completed}</span>
          </div>
          {overdue > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-400">Overdue</span>
              <span className="text-sm font-semibold text-red-400 tabular-nums">{overdue}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
