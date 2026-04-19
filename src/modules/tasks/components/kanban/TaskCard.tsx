// TaskCard with colored tags aligned to design system
"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { format, isPast, differenceInDays } from "date-fns";
import { useState } from "react";
import { AlertTriangle, Calendar, GripVertical, MoreHorizontal, Pencil, Tag, Trash2 } from "lucide-react";
import { cn } from "@/shared/utils/utils";
import type { Task } from "@/modules/tasks/types";
import { PriorityIcon } from "../../../../shared/components/icons/PriorityIcon";
import { EditTaskModal } from "../modals/EditTaskModal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { useDeleteTask } from "@/modules/tasks/hooks/useTasks";

interface TaskCardProps {
  task: Task;
  isOverlay?: boolean;
}

export function TaskCard({ task, isOverlay = false }: TaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id });

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const deleteTask = useDeleteTask();

  const dueDate = task.due_date ? new Date(task.due_date) : null;
  const overdue =
    !!dueDate && isPast(dueDate) && task.status?.name?.toLowerCase() !== "done";
  const daysUntilDue = dueDate ? differenceInDays(dueDate, new Date()) : null;

  const style = isOverlay
    ? undefined
    : {
        transform: CSS.Transform.toString(transform),
        transition,
      };

  const dueTone =
    overdue || (daysUntilDue !== null && daysUntilDue <= 3)
      ? "#f59e0b"
      : "var(--color-text-tertiary)";

  const content = (
    <div
      className={cn(
        "group relative rounded-lg border p-3 transition-colors duration-100",
        !isOverlay && "cursor-pointer",
        isDragging && !isOverlay && "opacity-0"
      )}
      style={{
        backgroundColor: "var(--color-surface-1)",
        borderColor: "var(--color-border-subtle)",
      }}
      onMouseEnter={(e) => {
        if (!isOverlay) e.currentTarget.style.backgroundColor = "var(--color-surface-2)";
      }}
      onMouseLeave={(e) => {
        if (!isOverlay) e.currentTarget.style.backgroundColor = "var(--color-surface-1)";
      }}
    >
      {!isOverlay && (
        <div
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          className="absolute -left-2 top-3 flex h-8 w-5 items-center justify-center rounded-md border opacity-0 transition-opacity group-hover:opacity-100 cursor-grab active:cursor-grabbing"
          style={{
            backgroundColor: "var(--color-surface-2)",
            borderColor: "var(--color-border-subtle)",
            color: "var(--color-text-tertiary)",
          }}
        >
          <GripVertical size={12} />
        </div>
      )}

      <div className="pr-7">
        <h3
          className="truncate text-sm font-medium leading-tight"
          style={{
            color: overdue ? "#f59e0b" : "var(--color-text-primary)",
          }}
        >
          {task.title}
        </h3>

        {task.description && (
          <p
            className="mt-1 line-clamp-2 text-xs leading-snug"
            style={{ color: "var(--color-text-secondary)" }}
          >
            {task.description}
          </p>
        )}
      </div>

      <div className="mt-3 flex items-end justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <PriorityIcon priority={task.priority} />

          <div className="flex min-w-0 items-center gap-1">
            {task.tags?.slice(0, 2).map((tag) => (
              <span
                key={tag.id}
                className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium"
                style={{
                  backgroundColor: (tag.color ?? "#71717a") + "1a",
                  border: "1px solid " + (tag.color ?? "#71717a") + "33",
                  color: tag.color ?? "#71717a",
                  maxWidth: "92px",
                }}
              >
                <Tag size={10} className="shrink-0" />
                <span className="truncate">{tag.name}</span>
              </span>
            ))}

            {task.tags && task.tags.length > 2 && (
              <span className="text-[10px]" style={{ color: "var(--color-text-tertiary)" }}>
                +{task.tags.length - 2}
              </span>
            )}
          </div>
        </div>

        {dueDate && (
          <div
            className="inline-flex items-center gap-1 text-[10px] font-medium"
            style={{ color: dueTone }}
          >
            {overdue ? <AlertTriangle size={10} /> : <Calendar size={10} />}
            {format(dueDate, "MMM d")}
          </div>
        )}
      </div>

      {!isOverlay && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              onClick={(e) => e.stopPropagation()}
              className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-md opacity-0 transition-all duration-100 group-hover:opacity-100"
              style={{ color: "var(--color-text-tertiary)" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "var(--color-surface-2)";
                e.currentTarget.style.color = "var(--color-text-primary)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
                e.currentTarget.style.color = "var(--color-text-tertiary)";
              }}
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
              onClick={(e) => { e.stopPropagation(); setIsEditModalOpen(true); }}
            >
              <Pencil size={12} />
              Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="gap-2 text-xs cursor-pointer text-red-400 focus:text-red-300 focus:bg-red-500/10"
              onClick={(e) => {
                e.stopPropagation();
                deleteTask.mutate({ taskId: task.id, projectId: task.project_id });
              }}
            >
              <Trash2 size={12} />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );

  return (
    <>
      <div
        ref={isOverlay ? undefined : setNodeRef}
        style={style}
        onClick={isOverlay ? undefined : () => setIsEditModalOpen(true)}
      >
        {content}
      </div>

      {!isOverlay && (
        <EditTaskModal
          open={isEditModalOpen}
          onOpenChange={setIsEditModalOpen}
          task={task}
        />
      )}
    </>
  );
}
