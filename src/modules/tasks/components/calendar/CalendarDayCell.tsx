"use client";

import { format } from "date-fns";
import { cn } from "@/shared/utils/utils"
import { PriorityIcon } from "../PriorityIcon";
import { StatusIcon } from "../StatusIcon";
import type { Task } from "@/modules/tasks/types"

// =====================================================
// CALENDAR DAY CELL
// Single day with task mini-cards
// =====================================================

interface CalendarDayCellProps {
  day: Date;
  tasks: Task[];
  isCurrentMonth: boolean;
  isToday: boolean;
  onTaskClick: (task: Task) => void;
}

export function CalendarDayCell({
  day,
  tasks,
  isCurrentMonth,
  isToday,
  onTaskClick,
}: CalendarDayCellProps) {
  const dayNumber = format(day, "d");

  return (
    <div
      className={cn(
        "min-h-30 border-l border-r border-b border-white/5 p-2",
        "flex flex-col gap-1",
        !isCurrentMonth && "bg-zinc-950/50"
      )}
    >
      {/* Day number */}
      <div className="flex items-center justify-between mb-1">
        <span
          className={cn(
            "text-sm font-medium",
            isToday
              ? "flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white"
              : isCurrentMonth
                ? "text-zinc-300"
                : "text-zinc-600"
          )}
        >
          {dayNumber}
        </span>
      </div>

      {/* Tasks */}
      <div className="flex flex-col gap-1 overflow-y-auto">
        {tasks.map((task) => (
          <button
            key={task.id}
            onClick={() => onTaskClick(task)}
            className={cn(
              "w-full text-left px-2 py-1.5 rounded text-xs",
              "bg-zinc-800/50 border border-zinc-700/50",
              "hover:bg-zinc-800 hover:border-zinc-700",
              "transition-colors cursor-pointer",
              "flex items-center gap-1.5"
            )}
          >
            {/* Priority icon */}
            <div className="shrink-0">
              <PriorityIcon priority={task.priority} />
            </div>

            {/* Task title */}
            <span className="truncate text-zinc-200 flex-1">
              {task.title}
            </span>

            {/* Status icon */}
            <div className="shrink-0">
              <StatusIcon status={task.status?.name || "To Do"} size={12} />
            </div>
          </button>
        ))}

        {/* More indicator if too many tasks */}
        {tasks.length > 5 && (
          <div className="text-xs text-zinc-600 text-center py-1">
            +{tasks.length - 5} more
          </div>
        )}
      </div>
    </div>
  );
}