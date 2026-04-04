"use client";

import { useDroppable } from "@dnd-kit/core";
import { CreateTaskModal } from "../modals/CreateTaskModal";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import { cn } from "@/shared/utils/utils"
import { TaskCard } from "./TaskCard";
import type { Status, Task } from "@/modules/tasks/types"
import { useState } from "react";

// =====================================================
// KANBAN COLUMN COMPONENT
// =====================================================

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
    <div className="flex flex-col h-full min-w-[320px] max-w-95">
      {/* Column Header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-zinc-200">{status.name}</h2>
          <span className="px-2 py-0.5 rounded-md bg-zinc-800/60 border border-white/5 text-[11px] font-medium text-zinc-500">
            {tasks.length}
          </span>
        </div>

        {/* Quick Add Button */}
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className={cn(
            "w-7 h-7 rounded-lg flex items-center justify-center",
            "bg-zinc-800/40 border border-white/5",
            "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/80 hover:border-white/10",
            "transition-all",
          )}
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Droppable Area */}
      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 rounded-xl border-2 border-dashed transition-all p-2 space-y-2 overflow-y-auto",
          isActive // ← CHANGE isOver en isActive
            ? "border-blue-500 bg-blue-500/10"
            : "border-white/5 bg-zinc-900/20",
        )}
      >
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {tasks.length === 0 ? (
            // Empty State
            <div className="flex flex-col items-center justify-center h-40 text-center">
              <div className="w-12 h-12 rounded-xl bg-zinc-800/40 border border-white/5 flex items-center justify-center mb-3">
                <Plus size={20} className="text-zinc-600" />
              </div>
              <p className="text-sm text-zinc-600 mb-1">No tasks</p>
              <p className="text-xs text-zinc-700">
                Drag tasks here or click + to add
              </p>
            </div>
          ) : (
            tasks.map((task) => <TaskCard key={task.id} task={task} />)
          )}
        </SortableContext>
      </div>
      <CreateTaskModal
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        projectId={projectId}
        statusId={status.id}
        statusName={status.name}
      />
    </div>
  );
}
