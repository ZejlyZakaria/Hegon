import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as TaskService from "../service";
import { WORKSPACE_KEYS } from "./query-keys";
import { toast } from "@/shared/utils/toast";
import { useIsDemo } from "@/modules/settings/hooks/useSettings";
import { DemoReadOnlyError, handledDemoError } from "@/shared/utils/demo-guard";

export function useWorkspaceMembers(workspaceId: string | null) {
  return useQuery({
    queryKey: WORKSPACE_KEYS.members(workspaceId ?? ""),
    queryFn: () => TaskService.getWorkspaceMembers(workspaceId!),
    enabled: !!workspaceId,
    staleTime: 1000 * 60 * 5,
  });
}

export function useWorkspaceInvitations(workspaceId: string | null) {
  return useQuery({
    queryKey: WORKSPACE_KEYS.invitations(workspaceId ?? ""),
    queryFn: () => TaskService.getWorkspaceInvitations(workspaceId!),
    enabled: !!workspaceId,
    staleTime: 1000 * 30,
  });
}

export function useCreateWorkspaceInvitation(workspaceId: string | null) {
  const queryClient = useQueryClient();
  const isDemo = useIsDemo();
  return useMutation({
    mutationFn: (email: string) => {
      if (isDemo) throw new DemoReadOnlyError();
      return TaskService.createWorkspaceInvitation(workspaceId!, email);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WORKSPACE_KEYS.invitations(workspaceId ?? "") });
    },
    onError: (error) => {
      if (handledDemoError(error)) return;
      toast.error("Failed to create invitation.");
    },
  });
}

export function useRevokeWorkspaceInvitation(workspaceId: string | null) {
  const queryClient = useQueryClient();
  const isDemo = useIsDemo();
  return useMutation({
    mutationFn: (invitationId: string) => {
      if (isDemo) throw new DemoReadOnlyError();
      return TaskService.revokeWorkspaceInvitation(invitationId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WORKSPACE_KEYS.invitations(workspaceId ?? "") });
    },
    onError: (error) => {
      if (handledDemoError(error)) return;
      toast.error("Failed to revoke invitation.");
    },
  });
}
