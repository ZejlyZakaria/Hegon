"use client";

import { useEffect, useRef, useState } from "react";
import {
  ChevronRight,
  Plus,
  Folder,
  MoreHorizontal,
  PanelLeftClose,
  Pencil,
  Trash2,
  Settings,
} from "lucide-react";
import { motion } from "framer-motion";
import { useTasksStore } from "@/modules/tasks/store";
import { useWorkspaces } from "@/modules/tasks/hooks/useWorkspaces";
import { useProjects } from "@/modules/tasks/hooks/useProjects";
import { useRealtimeProjects } from "@/modules/tasks/hooks/useRealtimeProjects";
import { useRealtimeWorkspaces } from "@/modules/tasks/hooks/useRealtimeWorkspaces";
import { cn } from "@/shared/utils/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { WorkspaceModal } from "@/modules/tasks/components/modals/WorkspaceModal";
import { ProjectModal } from "@/modules/tasks/components/modals/ProjectModal";
import { DeleteWorkspaceModal } from "@/modules/tasks/components/modals/DeleteWorkspaceModal";
import { DeleteProjectModal } from "@/modules/tasks/components/modals/DeleteProjectModal";
import { WorkspaceInvitePanel } from "@/modules/tasks/components/panels/WorkspaceInvitePanel";
import type { Workspace, Project } from "@/modules/tasks/types";

interface WorkspaceItemProps {
  workspace: Workspace;
  isExpanded: boolean;
  onToggle: () => void;
  currentUserId: string | null;
}

function WorkspaceItem({
  workspace,
  isExpanded,
  onToggle,
  currentUserId,
}: WorkspaceItemProps) {
  const { selectedProjectId, setSelectedProjectId } = useTasksStore();
  const { data: projects, isLoading } = useProjects(workspace.id);
  useRealtimeProjects(workspace.id);

  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);
  const [invitePanelOpen, setInvitePanelOpen] = useState(false);

  const isOwner = workspace.user_id === currentUserId;

  useEffect(() => {
    if (!selectedProjectId && projects && projects.length > 0) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId, setSelectedProjectId]);

  const hasAutoExpandedRef = useRef(false);
  useEffect(() => {
    if (hasAutoExpandedRef.current) return;
    if (!projects || !selectedProjectId) return;
    if (!projects.some((p) => p.id === selectedProjectId)) return;
    hasAutoExpandedRef.current = true;
    if (!isExpanded) onToggle();
  }, [projects, selectedProjectId, isExpanded, onToggle]);

  return (
    <div className="space-y-0.5">
      <div
        className="group flex h-8 items-center gap-2 rounded-md px-2 transition-colors duration-100"
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = "var(--color-surface-2)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = "transparent";
        }}
      >
        <button
          type="button"
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-center gap-2"
        >
          <ChevronRight
            size={14}
            className={cn(
              "shrink-0 transition-transform duration-150",
              isExpanded && "rotate-90"
            )}
            style={{ color: "var(--color-text-tertiary)" }}
          />
          <span
            className="truncate text-left text-xs font-medium"
            style={{ color: "var(--color-text-secondary)" }}
          >
            {workspace.name}
          </span>
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md opacity-0 transition-opacity group-hover:opacity-100"
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "var(--color-surface-2)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
              }}
            >
              <MoreHorizontal size={12} style={{ color: "var(--color-text-tertiary)" }} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-44 rounded-lg"
            style={{
              backgroundColor: "var(--color-surface-3)",
              borderColor: "var(--color-border-default)",
              color: "var(--color-text-secondary)",
            }}
          >
            <DropdownMenuItem onClick={() => setCreateProjectOpen(true)} className="gap-2 text-xs">
              <Plus size={13} />
              New project
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setInvitePanelOpen(true)} className="gap-2 text-xs">
              <Settings size={13} />
              Workspace settings
            </DropdownMenuItem>
            {isOwner && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setRenameOpen(true)} className="gap-2 text-xs">
                  <Pencil size={13} />
                  Rename
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setDeleteOpen(true)} className="gap-2 text-xs text-red-400">
                  <Trash2 size={13} />
                  Delete
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {isExpanded && (
        <div className="ml-4 space-y-0.5">
          {isLoading && (
            <div
              className="px-2 py-1 text-xs"
              style={{ color: "var(--color-text-tertiary)" }}
            >
              Loading...
            </div>
          )}

          {projects?.map((project) => (
            <div
              key={project.id}
              className={cn(
                "group flex h-7 items-center gap-2 rounded-md px-2 text-xs transition-colors duration-100",
                selectedProjectId === project.id && ""
              )}
              style={{
                backgroundColor:
                  selectedProjectId === project.id
                    ? "var(--color-surface-2)"
                    : "transparent",
                color:
                  selectedProjectId === project.id
                    ? "var(--color-text-primary)"
                    : "var(--color-text-secondary)",
              }}
              onMouseEnter={(e) => {
                if (selectedProjectId !== project.id) {
                  e.currentTarget.style.backgroundColor = "var(--color-surface-2)";
                }
              }}
              onMouseLeave={(e) => {
                if (selectedProjectId !== project.id) {
                  e.currentTarget.style.backgroundColor = "transparent";
                }
              }}
            >
              <button
                type="button"
                onClick={() => setSelectedProjectId(project.id)}
                className="flex min-w-0 flex-1 items-center gap-2"
              >
                <Folder
                  size={12}
                  className="shrink-0"
                  style={{
                    color:
                      selectedProjectId === project.id
                        ? "var(--color-text-secondary)"
                        : "var(--color-text-tertiary)",
                  }}
                />
                <span className="truncate text-left text-xs">{project.name}</span>
              </button>

              <div className="flex shrink-0 items-center gap-1">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="flex h-7 w-7 items-center justify-center rounded-md opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      <MoreHorizontal size={11} style={{ color: "var(--color-text-tertiary)" }} />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="w-40 rounded-lg"
                    style={{
                      backgroundColor: "var(--color-surface-3)",
                      borderColor: "var(--color-border-default)",
                      color: "var(--color-text-secondary)",
                    }}
                  >
                    <DropdownMenuItem onClick={() => setEditingProject(project)} className="gap-2 text-xs">
                      <Pencil size={13} />
                      Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setDeletingProject(project)} className="gap-2 text-xs text-red-400">
                      <Trash2 size={13} />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {selectedProjectId === project.id && (
                  <span
                    className="h-3 w-1 rounded-full"
                    style={{ backgroundColor: "var(--color-accent-tasks)" }}
                  />
                )}
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={() => setCreateProjectOpen(true)}
            className="flex h-7 w-full items-center gap-2 rounded-md px-2 text-xs transition-colors duration-100"
            style={{ color: "var(--color-text-tertiary)" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--color-surface-2)";
              e.currentTarget.style.color = "var(--color-text-secondary)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
              e.currentTarget.style.color = "var(--color-text-tertiary)";
            }}
          >
            <Plus size={12} />
            <span>New Project</span>
          </button>
        </div>
      )}

      <WorkspaceInvitePanel
        workspace={workspace}
        currentUserId={currentUserId}
        open={invitePanelOpen}
        onClose={() => setInvitePanelOpen(false)}
      />
      <WorkspaceModal
        open={renameOpen}
        onOpenChange={setRenameOpen}
        workspace={workspace}
      />
      <DeleteWorkspaceModal
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        workspace={workspace}
        onDeleted={() => setSelectedProjectId(null)}
      />
      <ProjectModal
        open={createProjectOpen}
        onOpenChange={setCreateProjectOpen}
        workspaceId={workspace.id}
      />
      {editingProject && (
        <ProjectModal
          open={!!editingProject}
          onOpenChange={(open) => {
            if (!open) setEditingProject(null);
          }}
          workspaceId={workspace.id}
          project={editingProject}
        />
      )}
      {deletingProject && (
        <DeleteProjectModal
          open={!!deletingProject}
          onOpenChange={(open) => {
            if (!open) setDeletingProject(null);
          }}
          project={deletingProject}
          onDeleted={() => {
            if (selectedProjectId === deletingProject.id) setSelectedProjectId(null);
          }}
        />
      )}
    </div>
  );
}

export function TasksSidebar() {
  const { isSidebarCollapsed, toggleSidebar } = useTasksStore();
  const { data: workspaces } = useWorkspaces();
  const [expandedWorkspaces, setExpandedWorkspaces] = useState<Set<string>>(new Set());
  const [createWorkspaceOpen, setCreateWorkspaceOpen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useRealtimeWorkspaces(currentUserId);

  useEffect(() => {
    import("@/infrastructure/supabase/client").then(({ createClient }) => {
      createClient().auth.getUser().then(({ data }) => {
        setCurrentUserId(data.user?.id ?? null);
      });
    });
  }, []);

  const selectedProjectId = useTasksStore((s) => s.selectedProjectId);

  useEffect(() => {
    if (selectedProjectId) return;
    const firstId = workspaces?.[0]?.id;
    if (firstId && !expandedWorkspaces.has(firstId)) {
      setExpandedWorkspaces(new Set([firstId]));
    }
  }, [workspaces?.[0]?.id, selectedProjectId]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleWorkspace = (workspaceId: string) => {
    setExpandedWorkspaces((prev) => {
      const next = new Set(prev);
      if (next.has(workspaceId)) next.delete(workspaceId);
      else next.add(workspaceId);
      return next;
    });
  };

  if (isSidebarCollapsed) return null;

  return (
    <>
      <motion.aside
        initial={{ width: 0, opacity: 0 }}
        animate={{ width: 250, opacity: 1 }}
        exit={{ width: 0, opacity: 0 }}
        transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
        className="relative h-full shrink-0 border-r"
        style={{
          backgroundColor: "var(--color-surface-1)",
          borderColor: "var(--color-border-subtle)",
        }}
      >
        <div className="flex h-full flex-col">
          <div
            className="flex h-14 items-center justify-between border-b px-4 shrink-0"
            style={{ borderColor: "var(--color-border-subtle)" }}
          >
            <h2
              className="text-sm font-semibold"
              style={{ color: "var(--color-text-primary)" }}
            >
              Projects
            </h2>
            <button
              type="button"
              onClick={toggleSidebar}
              className="flex h-8 w-8 items-center justify-center rounded-md transition-colors duration-100"
              style={{ color: "var(--color-text-tertiary)" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "var(--color-surface-2)";
                e.currentTarget.style.color = "var(--color-text-primary)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
                e.currentTarget.style.color = "var(--color-text-tertiary)";
              }}
            >
              <PanelLeftClose size={16} />
            </button>
          </div>

          <div className="flex-1 space-y-1 overflow-y-auto px-2 py-3">
            {workspaces?.map((workspace) => (
              <WorkspaceItem
                key={workspace.id}
                workspace={workspace}
                isExpanded={expandedWorkspaces.has(workspace.id)}
                onToggle={() => toggleWorkspace(workspace.id)}
                currentUserId={currentUserId}
              />
            ))}
          </div>

          <div
            className="space-y-1 border-t p-2 shrink-0"
            style={{ borderColor: "var(--color-border-subtle)" }}
          >
            <button
              type="button"
              onClick={() => setCreateWorkspaceOpen(true)}
              className="flex h-8 w-full items-center justify-center gap-2 rounded-md transition-colors duration-100 text-sm font-medium"
              style={{
                backgroundColor: "var(--color-surface-2)",
                border: "1px solid var(--color-border-default)",
                color: "var(--color-text-primary)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "var(--color-surface-3)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "var(--color-surface-2)";
              }}
            >
              <Plus size={14} />
              <span>New Workspace</span>
            </button>

          </div>
        </div>
      </motion.aside>

      <WorkspaceModal
        open={createWorkspaceOpen}
        onOpenChange={setCreateWorkspaceOpen}
      />
    </>
  );
}
