"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/shared/utils/utils";
import { PriorityIcon } from "@/shared/components/icons/PriorityIcon";
import type { Goal, GoalCategory, GoalPriority } from "../types";

const ACCENT = "#18ad9d";

const CATEGORY_COLORS: Record<GoalCategory, string> = {
  personal:  "bg-pink-500/10 text-pink-400 border-pink-500/20", // flex-1 px-4 py-3 rounded-2xl border border-zinc-800/60 bg-zinc-900/30 flex flex-col gap-2
  work:      "bg-blue-500/10 text-blue-400 border-blue-500/20",
  health:    "bg-red-500/10 text-red-400 border-red-500/20",
  learning:  "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  finance:   "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  other:     "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
};

const PRIORITY_TEXT: Record<GoalPriority, string> = {
  critical: "text-red-400",
  high:     "text-orange-400",
  medium:   "text-yellow-500",
  low:      "text-zinc-500",
};

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function isOverdue(target_date: string | null, status: string) {
  if (!target_date || status === "completed") return false;
  return new Date(target_date) < new Date();
}

interface Props {
  goal: Goal;
}

export function GoalCard({ goal }: Props) {
  const router      = useRouter();
  const overdue     = isOverdue(goal.target_date, goal.status);
  const isCompleted = goal.status === "completed";

  return (
    <div
      onClick={() => router.push(`/life/goals/${goal.id}`)}
      className={cn(
        "relative overflow-hidden rounded-2xl border cursor-pointer",
        "bg-linear-to-b from-zinc-900/80 to-zinc-900/60 backdrop-blur-sm",
        "transition-all duration-200 hover:scale-[1.02] hover:shadow-lg hover:shadow-black/30",
        overdue ? "border-red-500/20" : "border-zinc-800/80",
        isCompleted && "opacity-50"
      )}
    >
      {overdue && (
        <div
          className="absolute top-0 inset-x-0 h-px"
          style={{ background: "linear-gradient(to right, transparent, rgba(239,68,68,0.4), transparent)" }}
        />
      )}

      <div className="relative p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold tracking-tight text-zinc-200 truncate">
              {goal.title}
            </h3>
            {goal.description && (
              <p className="mt-0.5 text-xs text-zinc-400 line-clamp-1">{goal.description}</p>
            )}
          </div>
          {goal.category && (
            <span className={cn(
              "shrink-0 rounded-lg border px-2 py-0.5 text-[10px] font-medium capitalize",
              CATEGORY_COLORS[goal.category]
            )}>
              {goal.category}
            </span>
          )}
        </div>

        {/* Progress */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-zinc-500">Progress</span>
            <span className="text-xs font-medium text-zinc-300">{goal.progress}%</span>
          </div>
          <div className="h-1 w-full rounded-full bg-zinc-800 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${goal.progress}%`, backgroundColor: ACCENT }}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2">
          {/* Priority */}
          <div className="flex items-center gap-1.5">
            <PriorityIcon priority={goal.priority} />
            <span className={cn("text-xs capitalize", PRIORITY_TEXT[goal.priority])}>
              {goal.priority}
            </span>
          </div>

          {/* Date + Status */}
          <div className="flex items-center gap-2 text-xs">
            {goal.target_date && (
              <span className={overdue ? "text-red-400" : "text-zinc-500"}>
                {formatDate(goal.target_date)}
              </span>
            )}
            <span className={cn(
              "capitalize",
              goal.status === "active"    && "text-zinc-400",
              goal.status === "completed" && "text-zinc-400",
              goal.status === "paused"    && "text-yellow-500/60",
              goal.status === "abandoned" && "text-red-500/40",
            )}>
              {goal.status}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
