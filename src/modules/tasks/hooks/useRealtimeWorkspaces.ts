"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRealtimeSync } from "@/shared/hooks/useRealtimeSync";
import { WORKSPACE_KEYS } from "./query-keys";

// Listens to:
// - workspaces table (rename/create/delete owned by user)
// - workspace_members rows for the current user (added to / removed from a
//   shared workspace → list must refresh).
export function useRealtimeWorkspaces(userId: string | null) {
  const queryClient = useQueryClient();

  useRealtimeSync({
    channelName: "workspaces-all",
    table: "workspaces",
    enabled: !!userId,
    onchange: () => {
      queryClient.invalidateQueries({ queryKey: WORKSPACE_KEYS.all });
    },
  });

  useRealtimeSync({
    channelName: `workspace-members-self-${userId ?? "none"}`,
    table: "workspace_members",
    filter: userId ? `user_id=eq.${userId}` : undefined,
    enabled: !!userId,
    onchange: () => {
      queryClient.invalidateQueries({ queryKey: WORKSPACE_KEYS.all });
    },
  });
}
