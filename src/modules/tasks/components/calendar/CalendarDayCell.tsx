"use client";

import { format } from "date-fns";
import { CalendarDays } from "lucide-react";
import { cn } from "@/shared/utils/utils";
import { PriorityIcon } from "../../../../shared/components/icons/PriorityIcon";
import type { Task } from "@/modules/tasks/types";

interface CalendarDayCellProps {
  day: Date;
  tasks: Task[];
  isCurrentMonth: boolean;
  isToday: boolean;
  onTaskClick: (task: Task) => void;
}

const MAX_VISIBLE = 6;

export function CalendarDayCell({
  day,
  tasks,
  isCurrentMonth,
  isToday,
  onTaskClick,
}: CalendarDayCellProps) {
  const dayNumber = format(day, "d");
  const visibleTasks = tasks.slice(0, MAX_VISIBLE);
  const remainingCount = Math.max(tasks.length - MAX_VISIBLE, 0);

  return (
    <div
      className={cn(
        "flex min-h-42 flex-col border-r border-b border-border-subtle p-2",
        isCurrentMonth ? "bg-surface-1" : "bg-surface-0 opacity-55"
      )}
    >
      <div className="mb-2 flex items-start justify-between">
        <span
          className={cn(
            "inline-flex h-7 min-w-7 items-center justify-center rounded-md px-1 text-sm font-semibold leading-none",
            isToday && "bg-surface-2 border border-border-default",
            isToday ? "text-text-primary" : isCurrentMonth ? "text-text-secondary" : "text-text-tertiary"
          )}
        >
          {dayNumber}
        </span>

        {tasks.length > 0 && (
          <span className="rounded px-1.5 py-0.5 text-[10px] font-medium bg-surface-2 border border-border-subtle text-text-tertiary">
            {tasks.length}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1">
        {visibleTasks.map((task) => (
          <button
            key={task.id}
            type="button"
            onClick={() => onTaskClick(task)}
            className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left transition-colors duration-100 bg-surface-2 border border-border-subtle hover:bg-surface-3"
          >
            <div className="shrink-0">
              <PriorityIcon priority={task.priority} />
            </div>
            <span className="truncate text-xs font-medium text-text-primary">
              {task.title}
            </span>
          </button>
        ))}

        {remainingCount > 0 && (
          <div className="mt-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium text-text-tertiary bg-surface-2 border border-border-subtle">
            <CalendarDays size={10} />
            +{remainingCount} more
          </div>
        )}
      </div>
    </div>
  );
}
