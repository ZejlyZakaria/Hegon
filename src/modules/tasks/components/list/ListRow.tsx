"use client";

import { useState } from "react";
import { cn } from "@/shared/utils/utils";
import { format, isPast, differenceInDays } from "date-fns";
import { Calendar, Tag, MoreHorizontal, User, Pencil, Trash2 } from "lucide-react";
import { PriorityIcon } from "../../../../shared/components/icons/PriorityIcon";
import { StatusIcon } from "../../../../shared/components/icons/StatusIcon";
import { MemberAvatar } from "../shared/MemberAvatar";
import { DeleteTaskModal } from "../modals/DeleteTaskModal";
import { useTasksStore } from "@/modules/tasks/store";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { formatDueDate } from "@/modules/tasks/lib/task-utils";
import type { Task } from "@/modules/tasks/types";

interface ListRowProps {
  task: Task;
}

export function ListRow({ task }: ListRowProps) {
  const { openEditModal } = useTasksStore();
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const dueDate = task.due_date ? new Date(task.due_date) : null;
  const overdue = !!dueDate && isPast(dueDate) && !task.status?.is_completed;
  const daysUntilDue = dueDate ? differenceInDays(dueDate, new Date()) : null;
  const urgent = overdue || (!task.status?.is_completed && daysUntilDue !== null && daysUntilDue <= 3);

  return (
    <>
      <div
        onClick={() => openEditModal(task.id)}
        className={cn(
          "group grid cursor-pointer grid-cols-[20px_16px_minmax(0,1fr)_auto] items-center gap-3 px-3 py-2 transition-colors duration-100",
          "border-b last:border-b-0 border-border-subtle hover:bg-surface-2"
        )}
      >
        <div className="flex w-5 shrink-0 items-center justify-center">
          <PriorityIcon priority={task.priority} />
        </div>

        <div className="flex w-4 shrink-0 items-center justify-center">
          <StatusIcon status={task.status} size={14} />
        </div>

        <div className="min-w-0">
          <span className="block truncate text-sm font-normal leading-tight text-text-primary">
            {task.title}
          </span>
        </div>

        <div className="flex items-center gap-4">
          {/* Tags */}
          <div className="flex w-fit items-center gap-1">
            {task.tags?.slice(0, 2).map((tag) => (
              <span
                key={tag.id}
                className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium"
                style={{
                  backgroundColor: (tag.color ?? "#71717a") + "1a",
                  border: `1px solid ${tag.color ?? "#71717a"}33`,
                  color: tag.color ?? "#71717a",
                }}
              >
                <Tag size={10} className="shrink-0" />
                <span className="truncate max-w-16">{tag.name}</span>
              </span>
            ))}
            {task.tags && task.tags.length > 2 && (
              <span className="text-[10px] text-text-tertiary">+{task.tags.length - 2}</span>
            )}
          </div>

          {/* Due date — icon colored by urgency */}
          <div className="min-w-14 shrink-0 flex justify-end">
            {dueDate ? (
              <div className={cn("inline-flex items-center gap-1 text-xs", overdue ? "text-[#ef4444]" : urgent ? "text-[#f59e0b]" : "text-text-tertiary")}>
                <Calendar size={12} />
                <span>{formatDueDate(dueDate)}</span>
              </div>
            ) : (
              <span className="text-xs text-text-tertiary">—</span>
            )}
          </div>

          {/* Start date — no icon */}
          <div className="w-14 shrink-0 flex justify-end">
            {task.start_date ? (
              <span className="text-xs text-text-tertiary">{format(new Date(task.start_date), "MMM d")}</span>
            ) : (
              <span className="text-xs text-text-tertiary">—</span>
            )}
          </div>

          {/* Assignee */}
          <div className="flex w-5 items-center justify-center">
            {task.assignee ? (
              <MemberAvatar member={task.assignee} size="sm" />
            ) : (
              <div className="w-5 h-5 rounded-full border border-dashed border-border-subtle flex items-center justify-center">
                <User size={9} className="text-text-tertiary" />
              </div>
            )}
          </div>

          {/* Menu */}
          <div className="w-8 shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => e.stopPropagation()}
                  className="flex h-8 w-8 items-center justify-center rounded-md opacity-0 transition-colors duration-100 group-hover:opacity-100 text-text-tertiary hover:bg-surface-2"
                >
                  <MoreHorizontal size={14} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-36 rounded-lg"
                style={{
                  backgroundColor: "var(--color-surface-3)",
                  borderColor: "var(--color-border-default)",
                  color: "var(--color-text-secondary)",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <DropdownMenuItem
                  className="gap-2 text-xs cursor-pointer"
                  onClick={(e) => { e.stopPropagation(); openEditModal(task.id); }}
                >
                  <Pencil size={12} />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="gap-2 text-xs cursor-pointer text-red-400 focus:text-red-300 focus:bg-red-500/10"
                  onClick={(e) => { e.stopPropagation(); setIsDeleteModalOpen(true); }}
                >
                  <Trash2 size={12} />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <DeleteTaskModal
        open={isDeleteModalOpen}
        onOpenChange={setIsDeleteModalOpen}
        taskId={task.id}
        taskTitle={task.title}
        projectId={task.project_id}
      />
    </>
  );
}
