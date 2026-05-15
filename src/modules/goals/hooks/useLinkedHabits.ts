import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as GoalService from "../service";
import {
  LINKED_HABIT_KEYS,
  AVAILABLE_HABIT_KEYS,
  AVAILABLE_TASK_KEYS,
} from "./query-keys";
import { toast } from "@/shared/utils/toast";

export function useLinkedHabits(goalId: string) {
  return useQuery({
    queryKey: LINKED_HABIT_KEYS.byGoal(goalId),
    queryFn:  () => GoalService.getLinkedHabits(goalId),
    enabled:  !!goalId,
    staleTime: 0,
  });
}

export function useLinkHabit(goalId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (habitId: string) => GoalService.linkHabitToGoal(habitId, goalId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: LINKED_HABIT_KEYS.byGoal(goalId) });
      queryClient.invalidateQueries({ queryKey: AVAILABLE_HABIT_KEYS.all });
    },
    onError: () => {
      toast.error("Failed to link habit.");
    },
  });
}

export function useUnlinkHabit(goalId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (habitId: string) => GoalService.unlinkHabitFromGoal(habitId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: LINKED_HABIT_KEYS.byGoal(goalId) });
      queryClient.invalidateQueries({ queryKey: AVAILABLE_HABIT_KEYS.all });
    },
    onError: () => {
      toast.error("Failed to unlink habit.");
    },
  });
}

export function useAvailableHabitsForGoal() {
  return useQuery({
    queryKey: AVAILABLE_HABIT_KEYS.all,
    queryFn:  () => GoalService.getAvailableHabitsForGoal(),
    staleTime: 0,
  });
}

export function useAvailableTasksForGoal() {
  return useQuery({
    queryKey: AVAILABLE_TASK_KEYS.all,
    queryFn:  () => GoalService.getAvailableTasksForGoal(),
    staleTime: 0,
  });
}
