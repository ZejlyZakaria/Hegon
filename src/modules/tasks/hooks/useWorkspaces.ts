import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as TaskService from "../service";
import { WORKSPACE_KEYS } from "./query-keys";
import { toast } from "@/shared/utils/toast";
import { useIsDemo } from "@/modules/settings/hooks/useSettings";
import { DemoReadOnlyError, handledDemoError } from "@/shared/utils/demo-guard";

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
  const isDemo = useIsDemo();
  return useMutation({
    mutationFn: (name: string) => {
      if (isDemo) throw new DemoReadOnlyError();
      return TaskService.createWorkspace(name);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WORKSPACE_KEYS.lists() });
      toast.success("Workspace created.");
    },
    onError: (error) => {
      if (handledDemoError(error)) return;
      toast.error("Failed to create workspace.");
    },
  });
}

export function useUpdateWorkspace() {
  const queryClient = useQueryClient();
  const isDemo = useIsDemo();
  return useMutation({
    mutationFn: ({ workspaceId, updates }: { workspaceId: string; updates: { name?: string } }) => {
      if (isDemo) throw new DemoReadOnlyError();
      return TaskService.updateWorkspace(workspaceId, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WORKSPACE_KEYS.lists() });
      toast("Workspace renamed.");
    },
    onError: (error) => {
      if (handledDemoError(error)) return;
      toast.error("Failed to rename workspace.");
    },
  });
}

export function useDeleteWorkspace() {
  const queryClient = useQueryClient();
  const isDemo = useIsDemo();
  return useMutation({
    mutationFn: (workspaceId: string) => {
      if (isDemo) throw new DemoReadOnlyError();
      return TaskService.deleteWorkspace(workspaceId);
    },
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
    onError: (error) => {
      if (handledDemoError(error)) return;
      toast.error("Failed to delete workspace.");
    },
  });
}