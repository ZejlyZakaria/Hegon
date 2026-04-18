import { useQuery } from "@tanstack/react-query";
import * as GoalService from "../service";
import { GOAL_KEYS } from "./query-keys";

export function useGoal(id: string) {
  return useQuery({
    queryKey: GOAL_KEYS.detail(id),
    queryFn:  () => GoalService.getGoal(id),
    enabled:  !!id,
    staleTime: 1000 * 60 * 5,
  });
}
