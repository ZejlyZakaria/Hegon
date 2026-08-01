"use client";

import { useMemo } from "react";
import Link from "next/link";
import { cn } from "@/shared/utils/utils";
import { PriorityIcon } from "@/shared/components/icons/PriorityIcon";
import { categoryColor, isGoalOverdue } from "../constants";
import { Badge } from "@/shared/components/ui/badge";
import type { Goal } from "../types";

function formatDate(dateStr: string | null) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function getMilestoneText(goal: Goal) {
  const milestones = goal.milestones ?? [];
  if (milestones.length === 0) return null;
  const completed = milestones.filter((m) => m.status === "completed").length;
  return `${completed}/${milestones.length} milestones`;
}

interface Props {
  goal: Goal;
}

export function GoalCard({ goal }: Props) {
  const overdue = isGoalOverdue(goal);
  const isCompleted = goal.status === "completed";
  const accent = categoryColor(goal.category);
  const milestoneText = getMilestoneText(goal);

  const daysUntilDeadline = useMemo(() => {
    if (!goal.target_date) return null;
    const now = new Date();
    return Math.ceil((new Date(goal.target_date).getTime() - now.getTime()) / 86400000);
  }, [goal.target_date]);
  const deadlineSoon =
    daysUntilDeadline !== null && daysUntilDeadline > 0 && daysUntilDeadline <= 7 && goal.status === "active";

  return (
    <Link
      href={`/life/goals/${goal.id}`}
      className={cn(
        "surface-card group block rounded-card p-3.5 transition-transform duration-200 ease-out hover:scale-[1.01]",
        isCompleted && "opacity-60",
      )}
    >
      <div className="flex flex-col gap-3 lg:grid lg:grid-cols-[minmax(0,1fr)_180px_140px] lg:items-center lg:gap-5">
        {/* Content */}
        <div className="min-w-0">
          {goal.category ? (
            <Badge color={accent} uppercase>{goal.category}</Badge>
          ) : (
            <Badge uppercase>No category</Badge>
          )}

          <h3
            className={cn(
              "mt-1 truncate text-[15px] font-semibold leading-snug",
              isCompleted ? "text-text-tertiary line-through" : "text-text-primary",
            )}
          >
            {goal.title}
          </h3>

          {goal.description && (
            <p className="mt-0.5 truncate text-xs text-text-secondary">{goal.description}</p>
          )}
        </div>

        {/* Progress column */}
        <div className="w-full lg:w-45">
          <div className="mb-1.5 flex items-baseline justify-between">
            <span className="text-sm font-bold tabular-nums text-text-primary">{goal.progress}%</span>
            {milestoneText && (
              <span className="text-[10px] text-text-tertiary">{milestoneText}</span>
            )}
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${goal.progress}%`, backgroundColor: accent }}
            />
          </div>
        </div>

        {/* Meta column — date + priority */}
        <div className="flex items-center justify-between gap-3 lg:flex-col lg:items-end lg:gap-1.5">
          {goal.target_date ? (
            <div className="flex items-center gap-1.5">
              {deadlineSoon && (
                <span
                  className="rounded-sm px-1.5 py-0.5 text-[10px] font-medium"
                  style={{ backgroundColor: "#f9731620", color: "#fb923c" }}
                >
                  {daysUntilDeadline}d
                </span>
              )}
              <span
                className="text-xs tabular-nums"
                style={{ color: overdue ? "#f87171" : "var(--color-text-tertiary)" }}
              >
                {formatDate(goal.target_date)}
              </span>
            </div>
          ) : (
            <span className="text-xs text-text-tertiary">No date</span>
          )}
          <div className="flex items-center gap-1.5">
            <PriorityIcon priority={goal.priority} />
            <span className="text-[11px] capitalize text-text-tertiary">{goal.priority}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
