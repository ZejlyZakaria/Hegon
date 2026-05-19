"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRealtimeSync } from "@/shared/hooks/useRealtimeSync";
import { TAG_KEYS, TASK_KEYS } from "./query-keys";
import type { Task } from "../types";

export function useRealtimeTags(workspaceId: string | null) {
  const queryClient = useQueryClient();

  useRealtimeSync({
    channelName: `tags-workspace-${workspaceId ?? "none"}`,
    table: "tags",
    filter: workspaceId ? `workspace_id=eq.${workspaceId}` : undefined,
    enabled: !!workspaceId,
    onchange: (payload) => {
      if (!workspaceId) return;
      // Tag list always changes
      queryClient.invalidateQueries({ queryKey: TAG_KEYS.byWorkspace(workspaceId) });

      // Tag rename/color/delete affects task cards that show this tag.
      // INSERT alone doesn't touch any task → skip the heavy task invalidation.
      if (payload.eventType === "INSERT") return;

      // For UPDATE/DELETE: only invalidate task caches that actually contain this tag.
      const tagId = (payload.new as { id?: string } | null)?.id
                 ?? (payload.old as { id?: string } | null)?.id;
      if (!tagId) return;

      const allTaskCaches = queryClient.getQueriesData<Task[]>({ queryKey: TASK_KEYS.all });
      for (const [key, tasks] of allTaskCaches) {
        if (tasks?.some((t) => t.tags?.some((tag) => tag.id === tagId))) {
          queryClient.invalidateQueries({ queryKey: key });
        }
      }
    },
  });

  // task_tags has no workspace_id column → rely on RLS to scope events.
  // Any add/remove of a tag on a task in an accessible workspace will fire.
  useRealtimeSync({
    channelName: `task-tags-workspace-${workspaceId ?? "none"}`,
    table: "task_tags",
    enabled: !!workspaceId,
    onchange: (payload) => {
      // Only invalidate the task cache that actually contains the changed task.
      // Avoids repainting all kanban columns on every tag toggle (audit §2.2).
      const taskId = (payload.new as { task_id?: string } | null)?.task_id
                  ?? (payload.old as { task_id?: string } | null)?.task_id;
      if (!taskId) return;

      const allTaskCaches = queryClient.getQueriesData<Task[]>({ queryKey: TASK_KEYS.all });
      for (const [key, tasks] of allTaskCaches) {
        if (tasks?.some((t) => t.id === taskId)) {
          queryClient.invalidateQueries({ queryKey: key });
          return;
        }
      }
    },
  });
}
