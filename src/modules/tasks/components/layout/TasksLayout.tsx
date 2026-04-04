"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/infrastructure/supabase/client";
import { useTasksStore } from "@/modules/tasks/store";
import { TasksSidebar } from "./TasksSidebar";
import { TasksTopbar } from "./TasksTopbar";
import { useWorkspaces } from "@/modules/tasks/hooks/useWorkspaces";
import { useProjects } from "@/modules/tasks/hooks/useProjects";
// =====================================================
// TASKS LAYOUT
// Combines: Global Sidebar (already rendered) + Tasks Sidebar + Topbar + Content
// =====================================================

interface TasksLayoutProps {
  children: React.ReactNode;
}

export function TasksLayout({ children }: TasksLayoutProps) {
  const [userId, setUserId] = useState<string | null>(null);

  // Get user ID
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id || null);
    });
  }, []);

  const { selectedProjectId } = useTasksStore();

  // Check si user a des projets
  const { data: workspaces } = useWorkspaces(userId || "");
  const firstWorkspaceId = workspaces?.[0]?.id ?? null;
  const { data: allProjects } = useProjects(firstWorkspaceId);
  const hasProjects = allProjects && allProjects.length > 0;

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Sidebar SEULEMENT si projets existent */}
      {hasProjects && <TasksSidebar />}

      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Topbar SEULEMENT si projet sélectionné */}
        {selectedProjectId && <TasksTopbar />}

        <div className="flex-1 overflow-y-auto relative">{children}</div>
      </div>
    </div>
  );
}
