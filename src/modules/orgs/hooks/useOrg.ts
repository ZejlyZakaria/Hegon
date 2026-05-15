"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as OrgService from "../service";
import { ORG_KEYS } from "./query-keys";
import { toast } from "@/shared/utils/toast";

export function useOrgInfo() {
  return useQuery({
    queryKey: ORG_KEYS.info,
    queryFn: OrgService.getOrgInfo,
    staleTime: 1000 * 60 * 10,
  });
}

export function useOrgMembers() {
  return useQuery({
    queryKey: ORG_KEYS.members,
    queryFn: OrgService.getOrgMembers,
    staleTime: 1000 * 60 * 5,
  });
}

export function useOrgInvitations() {
  return useQuery({
    queryKey: ORG_KEYS.invitations,
    queryFn: OrgService.getOrgInvitations,
    staleTime: 1000 * 60 * 2,
  });
}

export function useCreateInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (email: string) => OrgService.createInvitation(email),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ORG_KEYS.invitations });
    },
    onError: (error: Error) => {
      toast.error(`Failed to create invitation: ${error.message}`);
    },
  });
}

export function useRevokeInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (invitationId: string) => OrgService.revokeInvitation(invitationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ORG_KEYS.invitations });
      toast.success("Invitation revoked");
    },
    onError: (error: Error) => {
      toast.error(`Failed to revoke invitation: ${error.message}`);
    },
  });
}
