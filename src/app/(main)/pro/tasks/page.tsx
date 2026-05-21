"use client";

import { ErrorBoundary } from "react-error-boundary";
import { TasksLayout } from "@/modules/tasks/components/layout/TasksLayout";
import { KanbanBoard } from "@/modules/tasks/components/kanban/KanbanBoard";
import { CalendarView } from "@/modules/tasks/components/calendar/CalendarView";
import { ListView } from "@/modules/tasks/components/list";
import { NowView } from "@/modules/tasks/components/now/NowView";
import { TasksEmptyState } from "@/modules/tasks/components/TasksEmptyState";
import { TasksSkeleton } from "@/modules/tasks/components/TasksSkeletons";
import { TasksError } from "@/modules/tasks/components/TasksError";
import { useTasksStore } from "@/modules/tasks/store";
import { useWorkspaces } from "@/modules/tasks/hooks/useWorkspaces";
import { useCurrentUserId } from "@/shared/hooks/useCurrentUserId";

function TasksPageContent() {
  const { viewMode } = useTasksStore();
  const userId = useCurrentUserId();

  const { data: workspaces, isLoading: workspacesLoading } = useWorkspaces(userId || "");

  const isLoading = !userId || workspacesLoading;

  if (isLoading) return <TasksSkeleton />;

  // No workspaces at all → onboarding
  const isEmpty = !workspaces?.length;

  if (isEmpty) return <TasksEmptyState />;

  return (
    <TasksLayout>
      {viewMode === "now" && <NowView />}
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