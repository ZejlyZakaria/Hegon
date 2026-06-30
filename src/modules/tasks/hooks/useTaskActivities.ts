"use client";

import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/infrastructure/supabase/client";
import * as TaskService from "../service";
import { ACTIVITY_KEYS } from "./query-keys";
import { useIsDemo } from "@/modules/settings/hooks/useSettings";
import { DemoReadOnlyError, handledDemoError } from "@/shared/utils/demo-guard";

export function useTaskActivities(taskId: string | null) {
  const queryClient = useQueryClient();

  // Real-time: invalidate on INSERT so comments and actions appear live
  useEffect(() => {
    if (!taskId) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`task_activities:${taskId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "task_activities",
          filter: `task_id=eq.${taskId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ACTIVITY_KEYS.byTask(taskId) });
        },
      )
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [taskId, queryClient]);

  return useQuery({
    queryKey: ACTIVITY_KEYS.byTask(taskId ?? ""),
    queryFn: () => TaskService.getTaskActivities(taskId!),
    enabled: !!taskId,
    staleTime: 1000 * 30,
  });
}

export function useAddComment(taskId: string) {
  const queryClient = useQueryClient();
  const isDemo = useIsDemo();

  return useMutation({
    mutationFn: (text: string) => {
      if (isDemo) throw new DemoReadOnlyError();
      return TaskService.logActivity({ task_id: taskId, action: "commented", changes: { text } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ACTIVITY_KEYS.byTask(taskId) });
    },
    onError: handledDemoError,
  });
}

export function useUpdateComment(taskId: string) {
  const queryClient = useQueryClient();
  const isDemo = useIsDemo();

  return useMutation({
    mutationFn: ({ activityId, text }: { activityId: string; text: string }) => {
      if (isDemo) throw new DemoReadOnlyError();
      return TaskService.updateComment(activityId, text);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ACTIVITY_KEYS.byTask(taskId) });
    },
    onError: handledDemoError,
  });
}

export function useDeleteComment(taskId: string) {
  const queryClient = useQueryClient();
  const isDemo = useIsDemo();

  return useMutation({
    mutationFn: (activityId: string) => {
      if (isDemo) throw new DemoReadOnlyError();
      return TaskService.deleteComment(activityId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ACTIVITY_KEYS.byTask(taskId) });
    },
    onError: handledDemoError,
  });
}
