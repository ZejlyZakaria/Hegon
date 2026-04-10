import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as TaskService from "../service";
import { PROJECT_KEYS, WORKSPACE_KEYS } from "./query-keys";
import { toast } from "@/shared/utils/toast";

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
  return useMutation({
    mutationFn: (input: { workspace_id: string; name: string }) =>
      TaskService.createProject(input),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.byWorkspace(variables.workspace_id) });
      toast.success("Project created.");
    },
    onError: () => {
      toast.error("Failed to create project.");
    },
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, updates }: { projectId: string; workspaceId: string; updates: { name?: string } }) =>
      TaskService.updateProject(projectId, updates),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.byWorkspace(variables.workspaceId) });
      toast("Project renamed.");
    },
    onError: () => {
      toast.error("Failed to rename project.");
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId }: { projectId: string; workspaceId: string }) =>
      TaskService.deleteProject(projectId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.byWorkspace(variables.workspaceId) });
      queryClient.invalidateQueries({ queryKey: WORKSPACE_KEYS.lists() });
      toast("Project deleted.");
    },
    onError: () => {
      toast.error("Failed to delete project.");
    },
  });
}