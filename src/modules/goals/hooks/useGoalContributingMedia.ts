import { useQuery } from "@tanstack/react-query";
import { getGoalContributingMedia } from "../service";
import { GOAL_KEYS } from "./query-keys";
import type { Goal } from "../types";
import { STALE } from "@/shared/lib/stale";

// The watched media filling a watching-metric goal (count + recent posters).
// Enabled only for watching-metric goals.
export function useGoalContributingMedia(goal: Goal | undefined) {
  return useQuery({
    queryKey: [...GOAL_KEYS.detail(goal?.id ?? ""), "contributing-media"],
    queryFn: () => getGoalContributingMedia(goal!),
    enabled: !!goal && goal.metric_module === "watching",
    staleTime: STALE.MINUTE,
  });
}
