"use client";

import { useTasksStore } from "@/modules/tasks/store";
import { useCurrentUserId } from "@/shared/hooks/useCurrentUserId";
import { TasksSidebar } from "./TasksSidebar";
import { TasksTopbar } from "./TasksTopbar";
import { useWorkspaces } from "@/modules/tasks/hooks/useWorkspaces";
import { useProjects } from "@/modules/tasks/hooks/useProjects";

interface TasksLayoutProps {
  children: React.ReactNode;
}

function TasksHeader() {
  const { viewMode } = useTasksStore();

  const viewLabel =
    viewMode === "kanban"
      ? "Kanban"
      : viewMode === "list"
      ? "List"
      : "Calendar";

  return (
    <div className="px-4 pb-4 pt-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1
            className="text-xl font-bold leading-tight"
            style={{ color: "var(--color-text-primary)" }}
          >
            Tasks
          </h1>
          <p
            className="mt-0.5 text-xs"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            Plan clearly. Execute deliberately.
          </p>
        </div>

        <span
          className="rounded px-2 py-0.5 text-xs font-medium"
          style={{
            backgroundColor: "var(--color-surface-2)",
            border: "1px solid var(--color-border-subtle)",
            color: "var(--color-text-secondary)",
          }}
        >
          {viewLabel} view
        </span>
      </div>
    </div>
  );
}

export function TasksLayout({ children }: TasksLayoutProps) {
  const userId = useCurrentUserId();
  const { selectedProjectId } = useTasksStore();

  const { data: workspaces } = useWorkspaces(userId || "");
  const firstWorkspaceId = workspaces?.[0]?.id ?? null;
  const { data: allProjects } = useProjects(firstWorkspaceId);
  const hasProjects = !!allProjects && allProjects.length > 0;

  return (
    <div className="flex h-full w-full overflow-hidden">
      {hasProjects && <TasksSidebar />}

      <div className="flex h-full flex-1 flex-col overflow-hidden">
        {selectedProjectId && <TasksTopbar />}
        {selectedProjectId && <TasksHeader />}

        <div className="relative flex-1 overflow-auto">{children}</div>
      </div>
    </div>
  );
}
