"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRealtimeSync } from "@/shared/hooks/useRealtimeSync";
import { TASK_KEYS } from "./query-keys";

export function useRealtimeTasks(projectId: string | null) {
  const queryClient = useQueryClient();

  useRealtimeSync({
    channelName: `tasks-project-${projectId ?? "none"}`,
    table: "tasks",
    filter: projectId ? `project_id=eq.${projectId}` : undefined,
    enabled: !!projectId,
    onchange: () => {
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: TASK_KEYS.all });
      }
    },
  });
}
