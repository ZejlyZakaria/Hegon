"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as TaskService from "../service";
import { SUBTASK_KEYS, TASK_KEYS } from "./query-keys";
import { useIsDemo } from "@/modules/settings/hooks/useSettings";
import { DemoReadOnlyError, handledDemoError } from "@/shared/utils/demo-guard";

export function useSubTasks(parentTaskId: string | null) {
  return useQuery({
    queryKey: SUBTASK_KEYS.byParent(parentTaskId ?? ""),
    queryFn: () => TaskService.getSubTasks(parentTaskId!),
    enabled: !!parentTaskId,
    staleTime: 1000 * 30,
  });
}

export function useCreateSubTask(parentTaskId: string, projectId: string) {
  const queryClient = useQueryClient();
  const isDemo = useIsDemo();

  return useMutation({
    mutationFn: ({ title, statusId }: { title: string; statusId: string }) => {
      if (isDemo) throw new DemoReadOnlyError();
      return TaskService.createSubTask({
        parent_task_id: parentTaskId,
        project_id: projectId,
        title,
        status_id: statusId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SUBTASK_KEYS.byParent(parentTaskId) });
    },
    onError: handledDemoError,
  });
}

export function useToggleSubTask(parentTaskId: string) {
  const queryClient = useQueryClient();
  const isDemo = useIsDemo();

  return useMutation({
    mutationFn: ({ subtaskId, statusId, projectId }: { subtaskId: string; statusId: string; projectId: string }) => {
      if (isDemo) throw new DemoReadOnlyError();
      return TaskService.updateTask({ id: subtaskId, project_id: projectId, status_id: statusId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SUBTASK_KEYS.byParent(parentTaskId) });
    },
    onError: handledDemoError,
  });
}

export function useDeleteSubTask(parentTaskId: string, projectId: string) {
  const queryClient = useQueryClient();
  const isDemo = useIsDemo();

  return useMutation({
    mutationFn: (subtaskId: string) => {
      if (isDemo) throw new DemoReadOnlyError();
      return TaskService.deleteTask(subtaskId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SUBTASK_KEYS.byParent(parentTaskId) });
      queryClient.invalidateQueries({ queryKey: TASK_KEYS.byProject(projectId) });
    },
    onError: handledDemoError,
  });
}
