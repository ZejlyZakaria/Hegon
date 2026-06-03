// TaskCard with colored tags aligned to design system
"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { isPast, differenceInDays } from "date-fns";
import { formatDueDate } from "@/modules/tasks/lib/task-utils";
import { useState } from "react";
import { Calendar, GripVertical, MoreHorizontal, Pencil, Tag, Trash2, User } from "lucide-react";
import { MemberAvatar } from "../shared/MemberAvatar";
import { cn } from "@/shared/utils/utils";
import type { Task } from "@/modules/tasks/types";
import { PriorityIcon } from "../../../../shared/components/icons/PriorityIcon";
import { DeleteTaskModal } from "../modals/DeleteTaskModal";
import { useTasksStore } from "@/modules/tasks/store";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";

interface TaskCardProps {
  task: Task;
  isOverlay?: boolean;
}

export function TaskCard({ task, isOverlay = false }: TaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id });

  const { openEditModal } = useTasksStore();
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const dueDate = task.due_date ? new Date(task.due_date) : null;
  const overdue =
    !!dueDate && isPast(dueDate) && !task.status?.is_completed;
  const daysUntilDue = dueDate ? differenceInDays(dueDate, new Date()) : null;

  // Staleness — only when no due_date (due_date already signals urgency visually)
  const stalenessDays = !task.due_date
    ? differenceInDays(new Date(), new Date(task.updated_at))
    : null;
  const stalenessColor =
    stalenessDays === null || stalenessDays < 3 ? null
    : stalenessDays < 7  ? "#f59e0b"
    : stalenessDays < 14 ? "#f97316"
    : "#ef4444";

  const style = isOverlay
    ? undefined
    : {
        transform: CSS.Transform.toString(transform),
        transition,
      };

  const dueTone =
    overdue ? "#ef4444"
    : (!task.status?.is_completed && daysUntilDue !== null && daysUntilDue <= 3) ? "#f59e0b"
    : "var(--color-text-tertiary)";

  const content = (
    <div
      className={cn(
        "group relative rounded-lg border border-border-subtle bg-surface-1 p-3 transition-colors duration-100",
        !isOverlay && "cursor-pointer hover:bg-surface-2",
        isDragging && !isOverlay && "opacity-0"
      )}
    >
      {stalenessColor && (
        <div
          className={cn(
            "absolute inset-y-0 left-0 w-0.5 rounded-l-lg",
            stalenessDays !== null && stalenessDays >= 14 && "animate-pulse"
          )}
          style={{ backgroundColor: stalenessColor }}
        />
      )}

      {!isOverlay && (
        <div
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          className="absolute -left-2 top-3 flex h-8 w-5 items-center justify-center rounded-md border opacity-0 transition-opacity group-hover:opacity-100 cursor-grab active:cursor-grabbing bg-surface-2 border-border-subtle text-text-tertiary [@media(hover:none)]:opacity-50"
        >
          <GripVertical size={12} />
        </div>
      )}

      {/* Top-right: assignee avatar (always) + ... menu on hover */}
      <div className="absolute right-2 top-2 flex items-center gap-1">
        {!isOverlay && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                onClick={(e) => e.stopPropagation()}
                className="flex h-6 w-6 items-center justify-center rounded-md opacity-0 transition-[opacity,background-color,color] duration-100 group-hover:opacity-100 text-text-tertiary hover:bg-surface-2 hover:text-text-primary"
              >
                <MoreHorizontal size={13} />
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
        )}
        {task.assignee ? (
          <MemberAvatar member={task.assignee} size="sm" />
        ) : (
          <div className="w-5 h-5 rounded-full border border-dashed border-border-subtle flex items-center justify-center">
            <User size={10} className="text-text-tertiary" />
          </div>
        )}
      </div>

      <div className="pr-14">
        <h3
          className="truncate text-sm font-medium leading-tight"
          style={{
            color: "var(--color-text-primary)",
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
            className="inline-flex items-center gap-1 text-[10px] font-medium shrink-0"
            style={{ color: dueTone }}
          >
            <Calendar size={10} />
            {formatDueDate(dueDate)}
          </div>
        )}
      </div>

    </div>
  );

  return (
    <>
      <div
        ref={isOverlay ? undefined : setNodeRef}
        style={style}
        onClick={isOverlay ? undefined : () => openEditModal(task.id)}
      >
        {content}
      </div>

      {!isOverlay && (
        <DeleteTaskModal
          open={isDeleteModalOpen}
          onOpenChange={setIsDeleteModalOpen}
          taskId={task.id}
          taskTitle={task.title}
          projectId={task.project_id}
        />
      )}
    </>
  );
}
