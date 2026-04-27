import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as GoalService from "../service";
import { MILESTONE_KEYS, GOAL_KEYS } from "./query-keys";
import { toast } from "@/shared/utils/toast";
import type { CreateMilestoneInput, UpdateMilestoneInput } from "../types";

export function useMilestones(goalId: string) {
  return useQuery({
    queryKey: MILESTONE_KEYS.byGoal(goalId),
    queryFn:  () => GoalService.getMilestones(goalId),
    enabled:  !!goalId,
    staleTime: 1000 * 60 * 5,
  });
}

export function useCreateMilestone(goalId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateMilestoneInput) => GoalService.createMilestone(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MILESTONE_KEYS.byGoal(goalId) });
    },
    onError: () => {
      toast.error("Failed to add milestone.");
    },
  });
}

export function useUpdateMilestone(goalId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateMilestoneInput) => GoalService.updateMilestone(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MILESTONE_KEYS.byGoal(goalId) });
      queryClient.invalidateQueries({ queryKey: GOAL_KEYS.detail(goalId) });
    },
    onError: () => {
      toast.error("Failed to update milestone.");
    },
  });
}

export function useDeleteMilestone(goalId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => GoalService.deleteMilestone(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MILESTONE_KEYS.byGoal(goalId) });
      queryClient.invalidateQueries({ queryKey: GOAL_KEYS.lists() });
    },
    onError: () => {
      toast.error("Failed to delete milestone.");
    },
  });
}

export function useReorderMilestones(goalId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (updates: { id: string; order_index: number }[]) =>
      GoalService.reorderMilestones(updates),
    onError: () => {
      queryClient.invalidateQueries({ queryKey: MILESTONE_KEYS.byGoal(goalId) });
      toast.error("Failed to save order.");
    },
  });
}
