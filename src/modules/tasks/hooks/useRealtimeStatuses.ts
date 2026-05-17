"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRealtimeSync } from "@/shared/hooks/useRealtimeSync";
import { STATUS_KEYS } from "./query-keys";
import type { Status } from "../types";

export function useRealtimeStatuses(projectId: string | null) {
  const queryClient = useQueryClient();

  useRealtimeSync({
    channelName: `statuses-project-${projectId ?? "none"}`,
    table: "statuses",
    filter: projectId ? `project_id=eq.${projectId}` : undefined,
    enabled: !!projectId,
    onchange: (payload) => {
      if (!projectId) return;
      const key = STATUS_KEYS.byProject(projectId);

      if (payload.eventType === "INSERT") {
        const newStatus = payload.new as Status;
        queryClient.setQueryData<Status[]>(key, (old) => {
          if (!old) return old;
          if (old.some((s) => s.id === newStatus.id)) return old;
          return [...old, newStatus].sort((a, b) => a.position - b.position);
        });
      } else if (payload.eventType === "UPDATE") {
        const updated = payload.new as Status;
        queryClient.setQueryData<Status[]>(key, (old) => {
          if (!old) return old;
          return old.map((s) => (s.id === updated.id ? { ...s, ...updated } : s));
        });
      } else if (payload.eventType === "DELETE") {
        const deletedId = (payload.old as { id?: string }).id;
        if (!deletedId) return;
        queryClient.setQueryData<Status[]>(key, (old) => {
          if (!old) return old;
          return old.filter((s) => s.id !== deletedId);
        });
      }
    },
  });
}
