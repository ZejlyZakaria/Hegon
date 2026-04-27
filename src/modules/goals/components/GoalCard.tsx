"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/shared/utils/utils";
import { PriorityIcon } from "@/shared/components/icons/PriorityIcon";
import type { Goal, GoalCategory } from "../types";

const GOALS_ACCENT = "var(--color-accent-goals)";

const CATEGORY_STYLES: Record<
  GoalCategory,
  { dot: string; text: string }
> = {
  personal: { dot: "#ec4899", text: "#f472b6" },
  work: { dot: "#3b82f6", text: "#60a5fa" },
  health: { dot: "#22c55e", text: "#4ade80" },
  learning: { dot: "#eab308", text: "#facc15" },
  finance: { dot: "#06b6d4", text: "#22d3ee" },
  other: { dot: "#71717a", text: "#a1a1aa" },
};


function formatDate(dateStr: string | null) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

function isOverdue(targetDate: string | null, status: string) {
  if (!targetDate || status === "completed") return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const due = new Date(targetDate);
  due.setHours(0, 0, 0, 0);

  return due < today;
}

function getMilestoneText(goal: Goal) {
  const milestones = goal.milestones ?? [];
  const total = milestones.length;
  if (total === 0) return null;

  const completed = milestones.filter((m) => m.status === "completed").length;
  return `${completed}/${total} milestones`;
}

interface Props {
  goal: Goal;
}

export function GoalCard({ goal }: Props) {
  const overdue = isOverdue(goal.target_date, goal.status);
  const isCompleted = goal.status === "completed";
  const categoryStyle = goal.category ? CATEGORY_STYLES[goal.category] : null;
  const milestoneText = getMilestoneText(goal);

  const daysUntilDeadline = useMemo(() => {
    if (!goal.target_date) return null;
    const now = new Date();
    return Math.ceil((new Date(goal.target_date).getTime() - now.getTime()) / 86400000);
  }, [goal.target_date]);
  const deadlineSoon =
    daysUntilDeadline !== null &&
    daysUntilDeadline > 0 &&
    daysUntilDeadline <= 7 &&
    goal.status === "active";

  return (
    <Link
      href={`/life/goals/${goal.id}`}
      className={cn(
        "group rounded-lg border border-border-subtle p-3 bg-surface-1 hover:bg-surface-2 transition-colors duration-100 block",
        isCompleted && "opacity-50"
      )}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_240px_120px_44px] items-center gap-4">
        <div className="min-w-0">
          {goal.category && categoryStyle && (
            <div className="mb-2 flex items-center gap-1.5">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: categoryStyle.dot }}
              />
              <span
                className="text-[10px] font-medium capitalize"
                style={{ color: categoryStyle.text }}
              >
                {goal.category}
              </span>
            </div>
          )}

          <h3
            className={cn(
              "truncate text-sm font-semibold",
              isCompleted && "line-through"
            )}
            style={{
              color: isCompleted
                ? "var(--color-text-tertiary)"
                : "var(--color-text-primary)",
            }}
          >
            {goal.title}
          </h3>

          {goal.description && (
            <p
              className="mt-1 truncate text-xs"
              style={{ color: "var(--color-text-secondary)" }}
            >
              {goal.description}
            </p>
          )}
        </div>

        <div className="w-60">
          <div className="mb-1 flex items-center justify-between">
            <span
              className="text-sm font-bold leading-none"
              style={{ color: "var(--color-text-primary)" }}
            >
              {goal.progress}%
            </span>
          </div>

          <div
            className="h-1 w-full overflow-hidden rounded-full"
            style={{ backgroundColor: "var(--color-surface-2)" }}
          >
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${goal.progress}%`,
                backgroundColor: GOALS_ACCENT,
              }}
            />
          </div>

          {milestoneText && (
            <p
              className="mt-1 text-[10px]"
              style={{ color: "var(--color-text-tertiary)" }}
            >
              {milestoneText}
            </p>
          )}
        </div>

        <div className="w-30">
          {goal.target_date && (
            <div className="mb-1 flex flex-col gap-1">
              <span
                className="text-xs"
                style={{ color: overdue ? "#f87171" : "var(--color-text-tertiary)" }}
              >
                {formatDate(goal.target_date)}
              </span>
              {deadlineSoon && (
                <span
                  className="text-[10px] font-medium px-1.5 py-0.5 rounded-sm w-fit"
                  style={{ backgroundColor: "#f9731620", color: "#fb923c" }}
                >
                  {daysUntilDeadline}d left
                </span>
              )}
            </div>
          )}

          <div className="flex items-center gap-1.5">
            <PriorityIcon priority={goal.priority} />
            <span className="text-xs capitalize" style={{ color: "var(--color-text-tertiary)" }}>
              {goal.priority}
            </span>
          </div>
        </div>

        <div className="flex w-11 justify-end">
          <ArrowRight
            size={16}
            style={{ color: "var(--color-text-tertiary)" }}
          />
        </div>
      </div>
    </Link>
  );
}
