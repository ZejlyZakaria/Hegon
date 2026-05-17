"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRealtimeSync } from "@/shared/hooks/useRealtimeSync";
import { PROJECT_KEYS } from "./query-keys";

export function useRealtimeProjects(workspaceId: string | null) {
  const queryClient = useQueryClient();

  useRealtimeSync({
    channelName: `projects-workspace-${workspaceId ?? "none"}`,
    table: "projects",
    filter: workspaceId ? `workspace_id=eq.${workspaceId}` : undefined,
    enabled: !!workspaceId,
    onchange: () => {
      if (!workspaceId) return;
      queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.byWorkspace(workspaceId) });
    },
  });
}
