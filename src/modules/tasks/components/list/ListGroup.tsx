"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import { StatusIcon } from "../../../../shared/components/icons/StatusIcon";
import { ListRow } from "./ListRow";
import { CreateTaskModal } from "../modals/CreateTaskModal";
import type { Status, Task } from "@/modules/tasks/types";

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
      <div className="mb-2">
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-md transition-colors cursor-pointer group/header text-text-secondary hover:bg-surface-2"
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          <div className="text-text-tertiary">
            {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
          </div>

          <StatusIcon status={status.name} size={14} />

          <span className="text-sm font-medium text-text-primary">
            {status.name}
          </span>

          <span className="text-xs font-medium ml-1 text-text-tertiary">
            {tasks.length}
          </span>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsCreateModalOpen(true);
            }}
            className="ml-auto w-7 h-7 rounded-md flex items-center justify-center opacity-0 group-hover/header:opacity-100 transition-opacity text-text-tertiary hover:bg-surface-2"
          >
            <Plus size={14} />
          </button>
        </div>

        {!isCollapsed && tasks.length > 0 && (
          <div className="ml-5 overflow-hidden rounded-lg border border-border-subtle">
            {tasks.map((task) => (
              <ListRow key={task.id} task={task} />
            ))}
          </div>
        )}

        {!isCollapsed && tasks.length === 0 && (
          <div className="ml-5 px-3 py-2 text-xs text-text-tertiary">
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
