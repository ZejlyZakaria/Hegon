"use client";

import { useMemo } from "react";
import { Target, Zap } from "lucide-react";
import { differenceInCalendarDays, format } from "date-fns";
import { useAllActiveTasks } from "../../hooks/useAllActiveTasks";
import { useTasksStore } from "../../store";
import { PriorityIcon } from "@/shared/components/icons/PriorityIcon";
import { cn } from "@/shared/utils/utils";
import type { Task, Priority } from "../../types";

// ─── Scoring ─────────────────────────────────────────────────────────────────

const PRIORITY_SCORE: Record<Priority, number> = {
  critical: 100,
  high: 60,
  medium: 30,
  low: 10,
};

type Badge = "overdue" | "today" | "critical" | "goal";

type ScoredTask = {
  task: Task;
  score: number;
  badges: Badge[];
};

function scoreTask(task: Task): ScoredTask {
  const badges: Badge[] = [];
  let score = PRIORITY_SCORE[task.priority] ?? 0;

  if (task.priority === "critical") badges.push("critical");

  if (task.due_date) {
    const diff = differenceInCalendarDays(new Date(task.due_date), new Date());
    if (diff < 0)       { score += 80; badges.push("overdue"); }
    else if (diff === 0) { score += 60; badges.push("today"); }
    else if (diff <= 2)  { score += 40; }
    else if (diff <= 7)  { score += 20; }
  }

  if (task.goal_id) { score += 20; badges.push("goal"); }

  return { task, score, badges };
}

// ─── Badge config ─────────────────────────────────────────────────────────────

const BADGE: Record<Badge, { label: string; className: string }> = {
  overdue:  { label: "Overdue",  className: "bg-red-500/15 text-red-400" },
  today:    { label: "Today",    className: "bg-amber-500/15 text-amber-400" },
  critical: { label: "Critical", className: "bg-red-500/15 text-red-400" },
  goal:     { label: "Goal",     className: "bg-green-500/15 text-green-400" },
};

// ─── Component ────────────────────────────────────────────────────────────────

export function NowView() {
  const { data: tasks = [], isLoading } = useAllActiveTasks();
  const { openEditModal, setSelectedProjectId } = useTasksStore();

  const ranked = useMemo<ScoredTask[]>(() => {
    return tasks
      .map(scoreTask)
      .sort((a, b) => b.score - a.score)
      .slice(0, 7);
  }, [tasks]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-border-subtle border-t-text-tertiary" />
      </div>
    );
  }

  if (ranked.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border-subtle bg-surface-1">
          <Zap size={20} className="text-text-tertiary" />
        </div>
        <div>
          <p className="text-sm font-medium text-text-primary">All clear</p>
          <p className="mt-0.5 text-xs text-text-tertiary">No active tasks across your projects.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-2xl px-6 py-8">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2">
            <Zap size={15} className="text-amber-400" />
            <h2 className="text-sm font-semibold text-text-primary">Now</h2>
          </div>
          <p className="mt-1 text-xs text-text-tertiary">
            Your top {ranked.length} tasks right now — ranked by priority, due date, and goal alignment.
          </p>
        </div>

        {/* Ranked list */}
        <div className="space-y-1">
          {ranked.map(({ task, badges }, i) => {
            const dueDate = task.due_date ? new Date(task.due_date) : null;
            const diffDays = dueDate ? differenceInCalendarDays(dueDate, new Date()) : null;
            const projectColor = task.project?.color ?? "#71717a";

            const dueDateLabel =
              diffDays === null  ? null
              : diffDays < 0     ? `${Math.abs(diffDays)}d overdue`
              : diffDays === 0   ? "Due today"
              : `Due ${format(dueDate!, "MMM d")}`;

            const showDueLabel = dueDateLabel && !badges.includes("overdue") && !badges.includes("today");

            return (
              <button
                key={task.id}
                type="button"
                onClick={() => {
                  setSelectedProjectId(task.project_id);
                  openEditModal(task.id);
                }}
                className="group flex w-full items-start gap-4 rounded-xl border border-transparent px-4 py-3.5 text-left transition-colors hover:border-border-subtle hover:bg-surface-1"
              >
                {/* Rank */}
                <span className="mt-0.5 w-4 shrink-0 text-right text-xs font-medium tabular-nums text-text-tertiary">
                  {i + 1}
                </span>

                {/* Priority */}
                <div className="mt-0.5 shrink-0">
                  <PriorityIcon priority={task.priority} />
                </div>

                {/* Title + project */}
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-sm font-medium leading-snug text-text-primary">
                    {task.title}
                  </span>
                  {task.project && (
                    <div className="flex items-center gap-1.5">
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ backgroundColor: projectColor }}
                      />
                      <span className="text-[11px] text-text-tertiary truncate">
                        {task.project.name}
                      </span>
                    </div>
                  )}
                </div>

                {/* Badges + due date */}
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                  {badges.map((badge) => (
                    <span
                      key={badge}
                      className={cn(
                        "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium",
                        BADGE[badge].className
                      )}
                    >
                      {badge === "goal" && <Target size={9} />}
                      {BADGE[badge].label}
                    </span>
                  ))}
                  {showDueLabel && (
                    <span className="text-[11px] text-text-tertiary">{dueDateLabel}</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        {tasks.length > 7 && (
          <p className="mt-6 text-center text-[11px] text-text-tertiary">
            Showing 7 of {tasks.length} active tasks — complete some to surface the next ones.
          </p>
        )}
      </div>
    </div>
  );
}
