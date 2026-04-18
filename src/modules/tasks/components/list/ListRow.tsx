"use client";

import { useState } from "react";
import { cn } from "@/shared/utils/utils"
import { format, isPast, differenceInDays } from "date-fns";
import { Calendar, Tag, MoreHorizontal } from "lucide-react";
import { PriorityIcon } from "../../../../shared/components/icons/PriorityIcon";
import { StatusIcon } from "../../../../shared/components/icons/StatusIcon";
import { EditTaskModal } from "../modals/EditTaskModal";
import type { Task } from "@/modules/tasks/types"

// =====================================================
// LIST ROW COMPONENT — Linear style
// =====================================================

interface ListRowProps {
  task: Task;
}

export function ListRow({ task }: ListRowProps) {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const dueDate = task.due_date ? new Date(task.due_date) : null;
  const isOverdue = dueDate && isPast(dueDate);
  const daysUntilDue = dueDate ? differenceInDays(dueDate, new Date()) : null;

  return (
    <>
      <div
        onClick={() => setIsEditModalOpen(true)}
        className={cn(
          "group flex items-center gap-3 px-4 py-2 min-h-9.5",
          "border-b border-white/4 last:border-b-0",
          "hover:bg-white/3 cursor-pointer transition-colors duration-100",
        )}
      >
        {/* Priority */}
        <div className="shrink-0 w-5 flex items-center justify-center">
          <PriorityIcon priority={task.priority} />
        </div>

        {/* Status Icon */}
        <div className="shrink-0 w-4 flex items-center justify-center">
          <StatusIcon
            status={task.status?.name ?? ""}
            size={14}
          />
        </div>

        {/* Title */}
        <span className="flex-1 text-sm text-zinc-200 truncate leading-tight">
          {task.title}
        </span>

        {/* Tags */}
        {task.tags && task.tags.length > 0 && (
          <div className="hidden sm:flex items-center gap-1 shrink-0">
            {task.tags.slice(0, 2).map((tag) => (
              <span
                key={tag.id}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-zinc-800/70 border border-white/5 text-[10px] text-zinc-400"
              >
                <Tag size={9} />
                {tag.name}
              </span>
            ))}
            {task.tags.length > 2 && (
              <span className="text-[10px] text-zinc-600">+{task.tags.length - 2}</span>
            )}
          </div>
        )}

        {/* Due Date */}
        {dueDate ? (
          <div
            className={cn(
              "hidden sm:flex items-center gap-1 shrink-0 px-1.5 py-0.5 rounded text-[11px] font-medium",
              isOverdue
                ? "text-red-400"
                : daysUntilDue !== null && daysUntilDue <= 3
                  ? "text-orange-400"
                  : "text-zinc-500",
            )}
          >
            <Calendar size={11} />
            {format(dueDate, "MMM d")}
          </div>
        ) : (
          <div className="hidden sm:block w-16" />
        )}

        {/* More Options */}
        <button
          onClick={(e) => {
            e.stopPropagation();
          }}
          className={cn(
            "shrink-0 w-6 h-6 rounded flex items-center justify-center",
            "opacity-0 group-hover:opacity-100 transition-opacity",
            "text-zinc-500 hover:text-zinc-300 hover:bg-white/8",
          )}
        >
          <MoreHorizontal size={14} />
        </button>
      </div>

      <EditTaskModal
        open={isEditModalOpen}
        onOpenChange={setIsEditModalOpen}
        task={task}
      />
    </>
  );
}
