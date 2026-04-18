"use client";

import { useSortable } from "@dnd-kit/sortable";
import { EditTaskModal } from "../modals/EditTaskModal";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Calendar, Tag, MoreHorizontal } from "lucide-react";
import { cn } from "@/shared/utils/utils";
import type { Task } from "@/modules/tasks/types";
import { format, isPast, differenceInDays } from "date-fns";
import { PriorityIcon } from "../../../../shared/components/icons/PriorityIcon";
import { useState } from "react";

// =====================================================
// TASK CARD COMPONENT
// =====================================================

interface TaskCardProps {
  task: Task;
}

export function TaskCard({ task }: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // Due date logic
  const dueDate = task.due_date ? new Date(task.due_date) : null;
  const isOverdue = dueDate && isPast(dueDate);
  const daysUntilDue = dueDate ? differenceInDays(dueDate, new Date()) : null;

  // Edit task modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        onClick={() => setIsEditModalOpen(true)}
        className={cn(
          "group relative bg-zinc-900/60 backdrop-blur-sm border border-white/8 rounded-lg p-3",
          "hover:bg-zinc-900/80 hover:border-white/12",
          "transition-all duration-150 cursor-pointer",
          isDragging && "opacity-0",
        )}
      >
        {/* Drag Handle */}
        <div
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()} // ← EMPÊCHE LE CLICK DE REMONTER
          className={cn(
            "absolute -left-2 top-3 w-5 h-8 flex items-center justify-center",
            "opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing",
            "bg-zinc-800/90 backdrop-blur-sm border border-white/8 rounded-lg",
          )}
        >
          <GripVertical size={14} className="text-zinc-500" />
        </div>

        {/* Title */}
        <h3 className="text-sm font-medium text-zinc-100 mb-2 pr-6 leading-snug">
          {task.title}
        </h3>

        {/* Description (if exists) */}
        {task.description && (
          <p className="text-xs text-zinc-500 mb-3 line-clamp-2 leading-relaxed">
            {task.description}
          </p>
        )}

        {/* Footer: Priority + Tags + Due Date */}
        <div className="flex items-center justify-between gap-2 mt-3">
          {/* Priority Icon */}
          <PriorityIcon priority={task.priority} />

          {/* Tags */}
          <div className="flex items-center gap-1 flex-1 min-w-0">
            {task.tags && task.tags.length > 0 ? (
              <>
                {task.tags.slice(0, 2).map((tag) => (
                  <span
                    key={tag.id}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium truncate"
                    style={{
                      maxWidth: "80px",
                      backgroundColor: `${tag.color ?? "#71717a"}18`,
                      color: tag.color ?? "#71717a",
                      border: `1px solid ${tag.color ?? "#71717a"}30`,
                    }}
                  >
                    <Tag size={9} className="shrink-0" />
                    {tag.name}
                  </span>
                ))}
                {task.tags.length > 2 && (
                  <span className="text-[10px] text-zinc-600">
                    +{task.tags.length - 2}
                  </span>
                )}
              </>
            ) : null}
          </div>

          {/* Due Date */}
          {dueDate && (
            <div
              className={cn(
                "flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium shrink-0",
                isOverdue
                  ? "bg-red-500/10 border border-red-500/20 text-red-400"
                  : daysUntilDue !== null && daysUntilDue <= 3
                    ? "bg-orange-500/10 border border-orange-500/20 text-orange-400"
                    : "bg-zinc-800/60 border border-white/5 text-zinc-500",
              )}
            >
              <Calendar size={10} />
              {format(dueDate, "MMM d")}
            </div>
          )}
        </div>

        {/* Hover: More Options */}
        <button
          type="button"
          onClick={(e) => e.stopPropagation()} // ← EMPÊCHE LE CLICK DE REMONTER
          className={cn(
            "absolute top-2 right-2 w-6 h-6 rounded-lg flex items-center justify-center",
            "opacity-0 group-hover:opacity-100 transition-opacity",
            "hover:bg-white/8 text-zinc-500 hover:text-zinc-300",
          )}
        >
          <MoreHorizontal size={14} />
        </button>
      </div>

      {/* Edit Modal (outside the card div to avoid click conflicts) */}
      <EditTaskModal
        open={isEditModalOpen}
        onOpenChange={setIsEditModalOpen}
        task={task}
      />
    </>
  );
}
