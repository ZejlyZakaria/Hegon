"use client";

import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useState } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/shared/utils/utils";
import { StatusIcon } from "../../../../shared/components/icons/StatusIcon";
import { TaskCard } from "./TaskCard";
import { CreateTaskModal } from "../modals/CreateTaskModal";
import type { Status, Task } from "@/modules/tasks/types";

interface KanbanColumnProps {
  status: Status;
  tasks: Task[];
  projectId: string;
  isActive?: boolean;
}

export function KanbanColumn({
  status,
  tasks,
  projectId,
  isActive,
}: KanbanColumnProps) {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const { setNodeRef } = useDroppable({
    id: status.id,
  });

  const taskIds = tasks.map((task) => task.id);

  return (
    <>
      <div className="flex w-[320px] flex-col">
        <div className="sticky top-0 z-10 mb-2 flex items-center justify-between px-1 py-1 bg-[#09090b]">
          <div className="flex items-center gap-2">
            <StatusIcon status={status} size={14} />
            <h2 className="text-sm font-semibold text-text-primary">
              {status.name}
            </h2>
            <span className="rounded px-2 py-0.5 text-xs font-medium bg-surface-2 border border-border-subtle text-text-tertiary">
              {tasks.length}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="flex h-8 w-8 items-center justify-center rounded-md transition-colors duration-100 text-text-tertiary hover:bg-surface-2 hover:text-text-primary"
          >
            <Plus size={14} />
          </button>
        </div>

        <div
          ref={setNodeRef}
          className={cn(
            "space-y-2 rounded-lg border p-2 transition-colors duration-100 overflow-hidden",
            isActive ? "bg-surface-2 border-border-default" : "bg-surface-1 border-border-subtle"
          )}
          style={status.color ? { borderTopColor: status.color, borderTopWidth: "2px" } : undefined}
        >
          <SortableContext
            items={taskIds}
            strategy={verticalListSortingStrategy}
          >
            {tasks.length === 0 ? (
              <div className="flex h-32 flex-col items-center justify-center text-center">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(true)}
                  className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg transition-colors duration-100 bg-surface-2 border border-border-subtle text-text-tertiary hover:bg-surface-3 hover:text-text-primary"
                >
                  <Plus size={18} />
                </button>
                <p className="text-sm font-medium text-text-secondary">
                  No tasks
                </p>
                <p className="mt-1 text-xs text-text-tertiary">
                  Drag tasks here or click + to add
                </p>
              </div>
            ) : (
              tasks.map((task) => <TaskCard key={task.id} task={task} />)
            )}
          </SortableContext>
        </div>
      </div>

      <CreateTaskModal
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        projectId={projectId}
        statusId={status.id}
        statusName={status.name}
      />
    </>
  );
}
