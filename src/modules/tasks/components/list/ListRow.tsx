"use client";

import { useState } from "react";
import { cn } from "@/shared/utils/utils";
import { format, isPast, differenceInDays } from "date-fns";
import { Calendar, Tag, MoreHorizontal, AlertTriangle } from "lucide-react";
import { PriorityIcon } from "../../../../shared/components/icons/PriorityIcon";
import { StatusIcon } from "../../../../shared/components/icons/StatusIcon";
import { EditTaskModal } from "../modals/EditTaskModal";
import type { Task } from "@/modules/tasks/types";

interface ListRowProps {
  task: Task;
}

export function ListRow({ task }: ListRowProps) {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const dueDate = task.due_date ? new Date(task.due_date) : null;
  const overdue = !!dueDate && isPast(dueDate) && task.status?.name?.toLowerCase() !== "done";
  const daysUntilDue = dueDate ? differenceInDays(dueDate, new Date()) : null;

  const dueTone =
    overdue || (daysUntilDue !== null && daysUntilDue <= 3)
      ? "#f59e0b"
      : "var(--color-text-tertiary)";

  return (
    <>
      <div
        onClick={() => setIsEditModalOpen(true)}
        className={cn(
          "group grid cursor-pointer grid-cols-[20px_16px_minmax(0,1fr)_auto_92px_32px] items-center gap-3 px-3 py-2 transition-colors duration-100",
          "border-b last:border-b-0"
        )}
        style={{
          borderColor: "var(--color-border-subtle)",
          backgroundColor: "transparent",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = "var(--color-surface-2)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = "transparent";
        }}
      >
        <div className="flex w-5 shrink-0 items-center justify-center">
          <PriorityIcon priority={task.priority} />
        </div>

        <div className="flex w-4 shrink-0 items-center justify-center">
          <StatusIcon status={task.status?.name ?? ""} size={14} />
        </div>

        <div className="min-w-0">
          <span
            className="block truncate text-sm font-medium leading-tight"
            style={{
              color: overdue ? "#f59e0b" : "var(--color-text-primary)",
            }}
          >
            {task.title}
          </span>
        </div>

        <div className="hidden shrink-0 items-center gap-1 md:flex">
          {task.tags && task.tags.length > 0 ? (
            <>
              {task.tags.slice(0, 2).map((tag) => (
                <span
                  key={tag.id}
                  className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium"
                  style={{
                    backgroundColor: "var(--color-surface-2)",
                    border: "1px solid var(--color-border-subtle)",
                    color: "var(--color-text-secondary)",
                  }}
                >
                  <Tag size={10} />
                  {tag.name}
                </span>
              ))}
              {task.tags.length > 2 && (
                <span
                  className="text-[10px] font-medium"
                  style={{ color: "var(--color-text-tertiary)" }}
                >
                  +{task.tags.length - 2}
                </span>
              )}
            </>
          ) : null}
        </div>

        <div className="hidden w-23 shrink-0 justify-end sm:flex">
          {dueDate ? (
            <div
              className="inline-flex items-center gap-1 text-xs"
              style={{ color: dueTone }}
            >
              {overdue ? <AlertTriangle size={12} /> : <Calendar size={12} />}
              <span>{format(dueDate, "MMM d")}</span>
            </div>
          ) : (
            <span
              className="text-xs"
              style={{ color: "var(--color-text-disabled)" }}
            >
              —
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md opacity-0 transition-colors duration-100 group-hover:opacity-100"
          style={{ color: "var(--color-text-tertiary)", backgroundColor: "transparent" }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "var(--color-surface-2)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
          }}
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
