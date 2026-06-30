import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as GoalService from "../service";
import { GOAL_KEYS } from "./query-keys";
import { toast } from "@/shared/utils/toast";
import { useIsDemo } from "@/modules/settings/hooks/useSettings";
import { DemoReadOnlyError, handledDemoError } from "@/shared/utils/demo-guard";
import type { CreateGoalInput, UpdateGoalInput } from "../types";

export function useGoals() {
  return useQuery({
    queryKey: GOAL_KEYS.lists(),
    queryFn:  () => GoalService.getGoals(),
    staleTime: 1000 * 60 * 5,
  });
}

export function useCreateGoal() {
  const queryClient = useQueryClient();
  const isDemo = useIsDemo();
  return useMutation({
    mutationFn: (input: CreateGoalInput) => {
      if (isDemo) throw new DemoReadOnlyError();
      return GoalService.createGoal(input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GOAL_KEYS.lists() });
      toast.success("Goal created.");
    },
    onError: (error) => {
      if (handledDemoError(error)) return;
      toast.error("Failed to create goal.");
    },
  });
}

export function useUpdateGoal() {
  const queryClient = useQueryClient();
  const isDemo = useIsDemo();
  return useMutation({
    mutationFn: (input: UpdateGoalInput) => {
      if (isDemo) throw new DemoReadOnlyError();
      return GoalService.updateGoal(input);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: GOAL_KEYS.lists() });
      queryClient.invalidateQueries({ queryKey: GOAL_KEYS.detail(data.id) });
      toast.success("Goal updated.");
    },
    onError: (error) => {
      if (handledDemoError(error)) return;
      toast.error("Failed to update goal.");
    },
  });
}

export function useDeleteGoal() {
  const queryClient = useQueryClient();
  const isDemo = useIsDemo();
  return useMutation({
    mutationFn: (id: string) => {
      if (isDemo) throw new DemoReadOnlyError();
      return GoalService.deleteGoal(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GOAL_KEYS.lists() });
      toast.success("Goal deleted.");
    },
    onError: (error) => {
      if (handledDemoError(error)) return;
      toast.error("Failed to delete goal.");
    },
  });
}
