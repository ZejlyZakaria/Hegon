import { useQuery } from "@tanstack/react-query";
import { getActiveWatchingGoals } from "@/modules/goals/service";
import { GOAL_KEYS } from "@/modules/goals/hooks/query-keys";

// Active watching-metric goals. Keyed under GOAL_KEYS so syncWatchingGoals'
// invalidation (GOAL_KEYS.all) also refreshes the Watching-side surfaces live.
export function useWatchingGoals(enabled = true) {
  return useQuery({
    queryKey: [...GOAL_KEYS.lists(), "watching"],
    queryFn: getActiveWatchingGoals,
    staleTime: 60 * 1000,
    enabled,
  });
}
