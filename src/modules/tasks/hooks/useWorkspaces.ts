import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as TaskService from "../service";
import { WORKSPACE_KEYS } from "./query-keys";
import { toast } from "@/shared/utils/toast";

// =====================================================
// HOOK: useWorkspaces
// =====================================================

export function useWorkspaces(userId?: string) {
  return useQuery({
    queryKey: WORKSPACE_KEYS.lists(),
    queryFn: () => TaskService.getWorkspaces(),
    enabled: userId !== undefined ? !!userId : true,
    staleTime: 1000 * 60 * 10,
  });
}

export function useCreateWorkspace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => TaskService.createWorkspace(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WORKSPACE_KEYS.lists() });
      toast.success("Workspace created.");
    },
    onError: () => {
      toast.error("Failed to create workspace.");
    },
  });
}

export function useUpdateWorkspace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ workspaceId, updates }: { workspaceId: string; updates: { name?: string } }) =>
      TaskService.updateWorkspace(workspaceId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WORKSPACE_KEYS.lists() });
      toast("Workspace renamed.");
    },
    onError: () => {
      toast.error("Failed to rename workspace.");
    },
  });
}

export function useDeleteWorkspace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (workspaceId: string) => TaskService.deleteWorkspace(workspaceId),
    onSuccess: () => {
      // Garde-fou 5: if this was the last workspace, clear cookie before redirect
      // so middleware re-checks and routes to /onboarding instead of trusting stale cache
      const cached = queryClient.getQueryData<{ id: string }[]>(WORKSPACE_KEYS.lists()) ?? [];
      if (cached.length <= 1 && typeof document !== "undefined") {
        document.cookie = "hegon_has_workspace=; max-age=0; path=/; samesite=lax";
      }
      queryClient.invalidateQueries({ queryKey: WORKSPACE_KEYS.lists() });
      toast("Workspace deleted.");
    },
    onError: () => {
      toast.error("Failed to delete workspace.");
    },
  });
}