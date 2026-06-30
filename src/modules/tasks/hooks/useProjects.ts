import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as TaskService from "../service";
import { PROJECT_KEYS, WORKSPACE_KEYS } from "./query-keys";
import { toast } from "@/shared/utils/toast";
import { useIsDemo } from "@/modules/settings/hooks/useSettings";
import { DemoReadOnlyError, handledDemoError } from "@/shared/utils/demo-guard";
import type { StatusType } from "../types";

// =====================================================
// HOOK: useProjects
// =====================================================

export function useProjects(workspaceId: string | null) {
  return useQuery({
    queryKey: PROJECT_KEYS.byWorkspace(workspaceId!),
    queryFn: () => TaskService.getProjects(workspaceId!),
    enabled: !!workspaceId,
    staleTime: 1000 * 60 * 5,
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  const isDemo = useIsDemo();
  return useMutation({
    mutationFn: (input: { workspace_id: string; name: string; workflow?: { type: StatusType; name: string; color: string }[] }) => {
      if (isDemo) throw new DemoReadOnlyError();
      return TaskService.createProject(input);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.byWorkspace(variables.workspace_id) });
      toast.success("Project created.");
    },
    onError: (error) => {
      if (handledDemoError(error)) return;
      toast.error("Failed to create project.");
    },
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();
  const isDemo = useIsDemo();
  return useMutation({
    mutationFn: ({ projectId, updates }: { projectId: string; workspaceId: string; updates: { name?: string } }) => {
      if (isDemo) throw new DemoReadOnlyError();
      return TaskService.updateProject(projectId, updates);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.byWorkspace(variables.workspaceId) });
      toast("Project renamed.");
    },
    onError: (error) => {
      if (handledDemoError(error)) return;
      toast.error("Failed to rename project.");
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  const isDemo = useIsDemo();
  return useMutation({
    mutationFn: ({ projectId }: { projectId: string; workspaceId: string }) => {
      if (isDemo) throw new DemoReadOnlyError();
      return TaskService.deleteProject(projectId);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.byWorkspace(variables.workspaceId) });
      queryClient.invalidateQueries({ queryKey: WORKSPACE_KEYS.lists() });
      toast("Project deleted.");
    },
    onError: (error) => {
      if (handledDemoError(error)) return;
      toast.error("Failed to delete project.");
    },
  });
}