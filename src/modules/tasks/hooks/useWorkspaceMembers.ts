import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as TaskService from "../service";
import { WORKSPACE_KEYS } from "./query-keys";
import { toast } from "@/shared/utils/toast";

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
  return useMutation({
    mutationFn: (email: string) => TaskService.createWorkspaceInvitation(workspaceId!, email),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WORKSPACE_KEYS.invitations(workspaceId ?? "") });
    },
    onError: () => {
      toast.error("Failed to create invitation.");
    },
  });
}

export function useRevokeWorkspaceInvitation(workspaceId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (invitationId: string) => TaskService.revokeWorkspaceInvitation(invitationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WORKSPACE_KEYS.invitations(workspaceId ?? "") });
    },
    onError: () => {
      toast.error("Failed to revoke invitation.");
    },
  });
}
