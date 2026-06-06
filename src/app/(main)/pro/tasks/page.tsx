"use client";

import { useEffect, useState } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { TasksLayout } from "@/modules/tasks/components/layout/TasksLayout";
import { KanbanBoard } from "@/modules/tasks/components/kanban/KanbanBoard";
import { CalendarView } from "@/modules/tasks/components/calendar/CalendarView";
import { ListView } from "@/modules/tasks/components/list";
import { NowView } from "@/modules/tasks/components/now/NowView";
import { TasksEmptyState } from "@/modules/tasks/components/TasksEmptyState";
import { TasksLoader } from "@/modules/tasks/components/TasksSkeletons";
import { TasksError } from "@/modules/tasks/components/TasksError";
import { useTasksStore } from "@/modules/tasks/store";
import { useWorkspaces } from "@/modules/tasks/hooks/useWorkspaces";
import { useCurrentUserId } from "@/shared/hooks/useCurrentUserId";

function TasksPageContent() {
  const { viewMode } = useTasksStore();
  const userId = useCurrentUserId();

  const { data: workspaces, isLoading: workspacesLoading } = useWorkspaces(userId || "");

  // `viewMode` is persisted in localStorage and only restored after mount. Until
  // then it reads the default ('kanban'), which would flash the wrong skeleton when
  // landing in another view. Gate on a mount flag so the view-specific skeleton is
  // only chosen once `viewMode` is the real, restored value.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot mount flag to gate on the persisted viewMode
    setHydrated(true);
  }, []);

  if (!hydrated || !userId) return <TasksLoader />;

  // Brand-new user with no workspaces → onboarding (no chrome). Only once the
  // query has actually resolved — while loading we mount the shell optimistically
  // (the common case is "has workspaces"), so the chrome never pops in late.
  if (!workspacesLoading && !workspaces?.length) return <TasksEmptyState />;

  // Real shell (sidebar + topbar) mounts immediately; each view shows its own
  // loading state inside the content area (kanban skeleton / centered spinner),
  // so there's no layout jump when the data arrives.
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