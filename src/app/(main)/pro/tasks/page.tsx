"use client";

import { ErrorBoundary } from "react-error-boundary";
import { TasksLayout } from "@/modules/tasks/components/layout/TasksLayout";
import { KanbanBoard } from "@/modules/tasks/components/kanban/KanbanBoard";
import { CalendarView } from "@/modules/tasks/components/calendar/CalendarView";
import { ListView } from "@/modules/tasks/components/list";
import { TasksEmptyState } from "@/modules/tasks/components/TasksEmptyState";
import { TasksSkeleton } from "@/modules/tasks/components/TasksSkeletons";
import { TasksError } from "@/modules/tasks/components/TasksError";
import { useTasksStore } from "@/modules/tasks/store";
import { useWorkspaces } from "@/modules/tasks/hooks/useWorkspaces";
import { useProjects } from "@/modules/tasks/hooks/useProjects";
import { useCurrentUserId } from "@/shared/hooks/useCurrentUserId";

function TasksPageContent() {
  const { viewMode } = useTasksStore();
  const userId = useCurrentUserId();

  const { data: workspaces, isLoading: workspacesLoading } = useWorkspaces(userId || "");

  const firstWorkspaceId = workspaces?.[0]?.id ?? null;
  const { data: projects, isLoading: projectsLoading } = useProjects(firstWorkspaceId);

  // Still resolving (including userId)
  const isLoading =
    !userId ||
    workspacesLoading ||
    (!!firstWorkspaceId && projectsLoading);

  if (isLoading) return <TasksSkeleton />;

  // No workspace at all, OR workspace exists but no projects
  const isEmpty = !workspaces?.length || !projects?.length;

  if (isEmpty) return <TasksEmptyState />;

  return (
    <TasksLayout>
      {viewMode === "kanban" && <KanbanBoard />}
      {viewMode === "list" && <ListView />}
      {viewMode === "calendar" && <CalendarView />}
    </TasksLayout>
  );
}

export default function TasksPage() {
  return (
    <ErrorBoundary
      FallbackComponent={TasksError}
      onReset={() => window.location.reload()}
    >
      <TasksPageContent />
    </ErrorBoundary>
  );
}