"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRealtimeSync } from "@/shared/hooks/useRealtimeSync";
import { TAG_KEYS, TASK_KEYS } from "./query-keys";

export function useRealtimeTags(workspaceId: string | null) {
  const queryClient = useQueryClient();

  useRealtimeSync({
    channelName: `tags-workspace-${workspaceId ?? "none"}`,
    table: "tags",
    filter: workspaceId ? `workspace_id=eq.${workspaceId}` : undefined,
    enabled: !!workspaceId,
    onchange: () => {
      if (!workspaceId) return;
      queryClient.invalidateQueries({ queryKey: TAG_KEYS.byWorkspace(workspaceId) });
      queryClient.invalidateQueries({ queryKey: TASK_KEYS.all });
    },
  });

  // task_tags has no workspace_id column → rely on RLS to scope events.
  // Any add/remove of a tag on a task in an accessible workspace will fire.
  useRealtimeSync({
    channelName: `task-tags-workspace-${workspaceId ?? "none"}`,
    table: "task_tags",
    enabled: !!workspaceId,
    onchange: () => {
      queryClient.invalidateQueries({ queryKey: TASK_KEYS.all });
    },
  });
}
