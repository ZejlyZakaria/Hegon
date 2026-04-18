"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import { cn } from "@/shared/utils/utils";
import { StatusIcon } from "../../../../shared/components/icons/StatusIcon";
import { ListRow } from "./ListRow";
import { CreateTaskModal } from "../modals/CreateTaskModal";
import type { Status, Task } from "@/modules/tasks/types";

// =====================================================
// LIST GROUP COMPONENT — Collapsible group per status
// =====================================================

interface ListGroupProps {
  status: Status;
  tasks: Task[];
  projectId: string;
}

export function ListGroup({ status, tasks, projectId }: ListGroupProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  return (
    <>
      <div className="mb-1">
        {/* Group Header */}
        <div
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg",
            "hover:bg-white/3 cursor-pointer transition-colors duration-100",
            "group/header",
          )}
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          {/* Chevron */}
          <div className="shrink-0 text-zinc-600">
            {isCollapsed ? (
              <ChevronRight size={14} />
            ) : (
              <ChevronDown size={14} />
            )}
          </div>

          {/* Status Icon */}
          <StatusIcon status={status.name} size={14} />

          {/* Status Name */}
          <span className="text-sm font-medium text-zinc-300">
            {status.name}
          </span>

          {/* Count */}
          <span className="text-xs text-zinc-600 font-medium">
            {tasks.length}
          </span>

          {/* Add Task Button (visible on hover) */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsCreateModalOpen(true);
            }}
            className={cn(
              "ml-auto w-6 h-6 rounded flex items-center justify-center",
              "opacity-0 group-hover/header:opacity-100 transition-opacity",
              "text-zinc-500 hover:text-zinc-300 hover:bg-white/8",
            )}
          >
            <Plus size={14} />
          </button>
        </div>

        {/* Task Rows */}
        {!isCollapsed && tasks.length > 0 && (
          <div className="ml-6 rounded-lg border border-white/5 bg-zinc-900/30 overflow-hidden">
            {tasks.map((task) => (
              <ListRow key={task.id} task={task} />
            ))}
          </div>
        )}

        {/* Empty State (not collapsed) */}
        {!isCollapsed && tasks.length === 0 && (
          <div className="ml-6 px-4 py-3 text-xs text-zinc-700">
            No tasks — click + to add one
          </div>
        )}
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
