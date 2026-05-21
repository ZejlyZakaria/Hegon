"use client";

import { useState } from "react";
import { cn } from "@/shared/utils/utils";
import { format, isPast, differenceInDays } from "date-fns";
import { Calendar, Tag, MoreHorizontal, AlertTriangle, User, Pencil, Trash2 } from "lucide-react";
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
  const urgent = overdue || (daysUntilDue !== null && daysUntilDue <= 3);

  return (
    <>
      <div
        onClick={() => openEditModal(task.id)}
        className={cn(
          "group grid cursor-pointer grid-cols-[20px_16px_minmax(0,1fr)_auto_92px_20px_32px] items-center gap-3 px-3 py-2 transition-colors duration-100",
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
          <span className={cn(
            "block truncate text-sm font-medium leading-tight",
            overdue ? "text-[#f59e0b]" : "text-text-primary"
          )}>
            {task.title}
          </span>
        </div>

        <div className="hidden shrink-0 items-center gap-1 md:flex">
          {task.tags && task.tags.length > 0 ? (
            <>
              {task.tags.slice(0, 2).map((tag) => (
                <span
                  key={tag.id}
                  className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium bg-surface-2 border border-border-subtle text-text-secondary"
                >
                  <Tag size={10} />
                  {tag.name}
                </span>
              ))}
              {task.tags.length > 2 && (
                <span className="text-[10px] font-medium text-text-tertiary">
                  +{task.tags.length - 2}
                </span>
              )}
            </>
          ) : null}
        </div>

        <div className="hidden w-23 shrink-0 justify-end sm:flex">
          {dueDate ? (
            <div className={cn("inline-flex items-center gap-1 text-xs", urgent ? "text-[#f59e0b]" : "text-text-tertiary")}>
              {overdue ? <AlertTriangle size={12} /> : <Calendar size={12} />}
              <span>{format(dueDate, "MMM d")}</span>
            </div>
          ) : (
            <span className="text-xs text-text-tertiary">—</span>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-center">
          {task.assignee ? (
            <MemberAvatar member={task.assignee} size="sm" />
          ) : (
            <div className="w-5 h-5 rounded-full border border-dashed border-border-subtle flex items-center justify-center">
              <User size={9} className="text-text-tertiary" />
            </div>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              onClick={(e) => e.stopPropagation()}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md opacity-0 transition-colors duration-100 group-hover:opacity-100 text-text-tertiary hover:bg-surface-2"
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
