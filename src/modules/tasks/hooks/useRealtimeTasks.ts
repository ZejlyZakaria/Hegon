"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRealtimeSync } from "@/shared/hooks/useRealtimeSync";
import { TASK_KEYS, STATUS_KEYS } from "./query-keys";
import { PROJECT_ASSIGNEE_KEYS } from "./useOrgMembers";
import { isOptimistic } from "./optimistic-tracker";
import type { Task, Status, Assignee } from "../types";

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
      const newRow = payload.new as (Record<string, unknown> & { id?: string }) | null;
      const oldRow = payload.old as { id?: string } | null;
      const changedId = newRow?.id ?? oldRow?.id;
      if (isOptimistic(changedId)) return;

      const key = TASK_KEYS.byProject(projectId);

      // Chirurgical setQueryData : évite le re-render global du kanban
      // sur chaque change d'un collaborateur (audit §2.3).
      if (payload.eventType === "DELETE") {
        if (!changedId) return;
        queryClient.setQueryData<Task[]>(key, (old) =>
          old?.filter((t) => t.id !== changedId)
        );
        return;
      }

      if (payload.eventType === "UPDATE" && newRow) {
        // Resolve joined fields from cache (status / assignee may have changed
        // along with status_id / assignee_id in the raw row)
        const statuses = queryClient.getQueryData<Status[]>(STATUS_KEYS.byProject(projectId));
        const members = queryClient.getQueryData<Assignee[]>(PROJECT_ASSIGNEE_KEYS.byProject(projectId));
        const newStatusId = newRow.status_id as string | undefined;
        const newAssigneeId = newRow.assignee_id as string | null | undefined;
        const newStatus = newStatusId ? statuses?.find((s) => s.id === newStatusId) : undefined;
        const newAssignee = newAssigneeId !== undefined
          ? (newAssigneeId === null ? null : (members?.find((m) => m.id === newAssigneeId) ?? null))
          : undefined;

        queryClient.setQueryData<Task[]>(key, (old) =>
          old?.map((t) => {
            if (t.id !== newRow.id) return t;
            return {
              ...t,
              ...newRow,
              status: newStatus ?? t.status,
              assignee: newAssignee !== undefined ? newAssignee : t.assignee,
            } as Task;
          })
        );
        return;
      }

      // INSERT : on n'a pas les jointures (project, status, assignee, tags) dans le
      // payload brut. Invalider pour refetch propre depuis getTasks().
      if (payload.eventType === "INSERT") {
        queryClient.invalidateQueries({ queryKey: key });
      }
    },
  });
}
