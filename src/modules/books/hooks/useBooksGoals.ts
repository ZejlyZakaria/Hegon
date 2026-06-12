import { useQuery } from "@tanstack/react-query";
import { getActiveBooksGoals } from "@/modules/goals/service";
import { GOAL_KEYS } from "@/modules/goals/hooks/query-keys";

// Active books-metric goals. Keyed under GOAL_KEYS so syncBooksGoals'
// invalidation (GOAL_KEYS.all) also refreshes the Books-side surfaces live.
export function useBooksGoals(enabled = true) {
  return useQuery({
    queryKey: [...GOAL_KEYS.lists(), "books"],
    queryFn: getActiveBooksGoals,
    staleTime: 60 * 1000,
    enabled,
  });
}
