"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRealtimeSync } from "@/shared/hooks/useRealtimeSync";
import { TASK_KEYS } from "./query-keys";
import { isOptimistic } from "./optimistic-tracker";

export function useRealtimeTasks(projectId: string | null) {
  const queryClient = useQueryClient();

  useRealtimeSync({
    channelName: `tasks-project-${projectId ?? "none"}`,
    table: "tasks",
    filter: projectId ? `project_id=eq.${projectId}` : undefined,
    enabled: !!projectId,
    onchange: (payload) => {
      if (!projectId) return;

      // Skip self-echo for tasks the local user is currently moving optimistically
      // → évite le snap-back de drag&drop.
      const newRow = payload.new as { id?: string } | null;
      const oldRow = payload.old as { id?: string } | null;
      const changedId = newRow?.id ?? oldRow?.id;
      if (isOptimistic(changedId)) return;

      queryClient.invalidateQueries({ queryKey: TASK_KEYS.byProject(projectId) });
    },
  });
}
