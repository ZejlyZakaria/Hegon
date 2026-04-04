"use client";

import { useEffect, useState } from "react";
import {
  ChevronRight,
  Plus,
  Folder,
  MoreHorizontal,
  PanelLeftClose,
} from "lucide-react";
import { useTasksStore } from "@/modules/tasks/store"
import { useWorkspaces } from "@/modules/tasks/hooks/useWorkspaces";
import { useProjects } from "@/modules/tasks/hooks/useProjects";
import { TASKS_SIDEBAR_GLASS } from "@/shared/constants/sidebar-colors";
import { cn } from "@/shared/utils/utils"
import { motion } from "framer-motion";
import type { Workspace } from "@/modules/tasks/types"

// =====================================================
// WORKSPACE ITEM — fetches its own projects
// =====================================================

interface WorkspaceItemProps {
  workspace: Workspace;
  isExpanded: boolean;
  onToggle: () => void;
}

function WorkspaceItem({ workspace, isExpanded, onToggle }: WorkspaceItemProps) {
  const { selectedProjectId, setSelectedProjectId } = useTasksStore();
  const { data: projects, isLoading } = useProjects(workspace.id);

  // Auto-select first project if none selected and projects exist
  useEffect(() => {
    if (!selectedProjectId && projects && projects.length > 0) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId, setSelectedProjectId]);

  return (
    <div className="space-y-0.5">
      {/* Workspace Header */}
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "w-full h-8 px-2 rounded-lg flex items-center gap-2",
          "text-zinc-400 hover:text-zinc-200 hover:bg-white/4",
          "transition-all group",
        )}
      >
        <ChevronRight
          size={14}
          className={cn(
            "text-zinc-600 transition-transform duration-150",
            isExpanded && "rotate-90",
          )}
        />
        <span className="text-xs font-semibold uppercase tracking-wider flex-1 text-left truncate">
          {workspace.name}
        </span>
        <div
          onClick={(e) => e.stopPropagation()}
          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-white/8 rounded transition-all cursor-pointer"
        >
          <MoreHorizontal size={12} />
        </div>
      </button>

      {/* Projects List */}
      {isExpanded && (
        <div className="ml-4 space-y-0.5">
          {isLoading && (
            <div className="px-3 py-1.5 text-xs text-zinc-600">Loading...</div>
          )}

          {projects?.map((project) => (
            <button
              type="button"
              key={project.id}
              onClick={() => setSelectedProjectId(project.id)}
              className={cn(
                "w-full h-8 px-2 rounded-lg flex items-center gap-2 group",
                "transition-all text-sm",
                selectedProjectId === project.id
                  ? "bg-white/8 text-white"
                  : "text-zinc-500 hover:text-zinc-200 hover:bg-white/4",
              )}
            >
              <Folder
                size={14}
                className={cn(
                  selectedProjectId === project.id ? "text-zinc-400" : "text-zinc-600",
                )}
              />
              <span className="flex-1 text-left truncate">{project.name}</span>
              {selectedProjectId === project.id && (
                <span className="w-1 h-3 rounded-full bg-zinc-400 shrink-0" />
              )}
            </button>
          ))}

          {/* New Project Button */}
          <button
            type="button"
            className={cn(
              "w-full h-8 px-2 rounded-lg flex items-center gap-2",
              "text-zinc-600 hover:text-zinc-400 hover:bg-white/4",
              "transition-all text-sm",
            )}
          >
            <Plus size={14} />
            <span>New Project</span>
          </button>
        </div>
      )}
    </div>
  );
}

// =====================================================
// TASKS SIDEBAR
// =====================================================

export function TasksSidebar() {
  const { isSidebarCollapsed, toggleSidebar } = useTasksStore();
  const { data: workspaces } = useWorkspaces();
  const [expandedWorkspaces, setExpandedWorkspaces] = useState<Set<string>>(new Set());

  // Auto-expand first workspace when it appears
  useEffect(() => {
    const firstId = workspaces?.[0]?.id;
    if (firstId && !expandedWorkspaces.has(firstId)) {
      setExpandedWorkspaces(new Set([firstId]));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaces?.[0]?.id]);

  const toggleWorkspace = (workspaceId: string) => {
    setExpandedWorkspaces((prev) => {
      const next = new Set(prev);
      if (next.has(workspaceId)) {
        next.delete(workspaceId);
      } else {
        next.add(workspaceId);
      }
      return next;
    });
  };

  if (isSidebarCollapsed) return null;

  return (
    <motion.aside
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: 250, opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
      className={cn(
        "relative h-full shrink-0 border-r",
        TASKS_SIDEBAR_GLASS.background,
        TASKS_SIDEBAR_GLASS.backdropBlur,
        TASKS_SIDEBAR_GLASS.border,
      )}
    >
      {/* Top gradient shine */}
      <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/10 to-transparent" />

      {/* Subtle vertical gradient */}
      <div
        className={cn(
          "absolute inset-0 bg-linear-to-b pointer-events-none",
          TASKS_SIDEBAR_GLASS.gradientTop,
          TASKS_SIDEBAR_GLASS.gradientBottom,
        )}
      />

      {/* Content */}
      <div className="relative z-10 h-full flex flex-col">
        {/* Header */}
        <div className="h-14 border-b border-white/5 flex items-center justify-between px-4 shrink-0">
          <h2 className="text-sm font-semibold text-zinc-100">Projects</h2>
          <button
            onClick={toggleSidebar}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-colors"
          >
            <PanelLeftClose size={16} />
          </button>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-2 space-y-1">
          {/* {workspacesLoading && <SidebarNavSkeleton />} */}

          {workspaces?.map((workspace) => (
            <WorkspaceItem
              key={workspace.id}
              workspace={workspace}
              isExpanded={expandedWorkspaces.has(workspace.id)}
              onToggle={() => toggleWorkspace(workspace.id)}
            />
          ))}
        </div>

        {/* Footer */}
        <div className="border-t border-white/5 p-2 shrink-0">
          <button
            type="button"
            className={cn(
              "w-full h-8 px-3 rounded-lg flex items-center justify-center gap-2",
              "bg-white/4 border border-white/5",
              "text-zinc-400 text-sm font-medium",
              "hover:bg-white/8 hover:text-zinc-300",
              "transition-all",
            )}
          >
            <Plus size={14} />
            <span>New Workspace</span>
          </button>
        </div>
      </div>
    </motion.aside>
  );
}
