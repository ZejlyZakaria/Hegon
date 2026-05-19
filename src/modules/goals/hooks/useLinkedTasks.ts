import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as GoalService from "../service";
import { LINKED_TASK_KEYS, GOAL_KEYS } from "./query-keys";
import { TASK_KEYS } from "@/modules/tasks/hooks/query-keys";
import { toast } from "@/shared/utils/toast";

export function useLinkedTasks(goalId: string) {
  return useQuery({
    queryKey: LINKED_TASK_KEYS.byGoal(goalId),
    queryFn:  () => GoalService.getLinkedTasks(goalId),
    enabled:  !!goalId,
    staleTime: 1000 * 60 * 2,
  });
}

export function useLinkTask(goalId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) => GoalService.linkTaskToGoal(taskId, goalId),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: LINKED_TASK_KEYS.byGoal(goalId) });
      // Invalidate tasks cache so /pro/tasks sees the new goal_id (otherwise
      // a later move on that task can't trigger recalcGoalIfAuto — it reads
      // a stale `goal_id: null` from cache.)
      queryClient.invalidateQueries({ queryKey: TASK_KEYS.all });
      // Recalculate progress if auto mode
      const goal = queryClient.getQueryData<{ progress_mode: string }>(GOAL_KEYS.detail(goalId));
      if (goal?.progress_mode === "auto") {
        await GoalService.recalculateProgress(goalId);
        queryClient.invalidateQueries({ queryKey: GOAL_KEYS.detail(goalId) });
        queryClient.invalidateQueries({ queryKey: GOAL_KEYS.lists() });
      }
    },
    onError: () => {
      toast.error("Failed to link task.");
    },
  });
}

export function useUnlinkTask(goalId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) => GoalService.unlinkTaskFromGoal(taskId),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: LINKED_TASK_KEYS.byGoal(goalId) });
      queryClient.invalidateQueries({ queryKey: TASK_KEYS.all });
      const goal = queryClient.getQueryData<{ progress_mode: string }>(GOAL_KEYS.detail(goalId));
      if (goal?.progress_mode === "auto") {
        await GoalService.recalculateProgress(goalId);
        queryClient.invalidateQueries({ queryKey: GOAL_KEYS.detail(goalId) });
        queryClient.invalidateQueries({ queryKey: GOAL_KEYS.lists() });
      }
    },
    onError: () => {
      toast.error("Failed to unlink task.");
    },
  });
}
