"use client";

import { useTasksStore } from "@/modules/tasks/store";
import { useCurrentUserId } from "@/shared/hooks/useCurrentUserId";
import { TasksSidebar } from "./TasksSidebar";
import { TasksTopbar } from "./TasksTopbar";
import { useWorkspaces } from "@/modules/tasks/hooks/useWorkspaces";
import { TaskDetailPanel } from "@/modules/tasks/components/panels/TaskDetailPanel";
import { NoProjectSelected } from "@/modules/tasks/components/NoProjectSelected";

interface TasksLayoutProps {
  children: React.ReactNode;
}

export function TasksLayout({ children }: TasksLayoutProps) {
  const userId = useCurrentUserId();
  const { selectedProjectId, viewMode } = useTasksStore();

  const { data: workspaces } = useWorkspaces(userId || "");
  const hasWorkspaces = !!workspaces && workspaces.length > 0;

  const showNoProjectSelected = hasWorkspaces && !selectedProjectId && viewMode !== "now";

  return (
    <div className="flex h-full w-full overflow-hidden">
      {hasWorkspaces && <TasksSidebar />}

      <div className="flex h-full flex-1 flex-col overflow-hidden">
        {(selectedProjectId || viewMode === "now") && <TasksTopbar />}

        <div className="relative flex-1 overflow-auto">
          {showNoProjectSelected ? <NoProjectSelected /> : children}
        </div>
      </div>

      <TaskDetailPanel />
    </div>
  );
}
