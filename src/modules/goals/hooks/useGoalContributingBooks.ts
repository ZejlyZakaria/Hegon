import { useQuery } from "@tanstack/react-query";
import { getGoalContributingBooks } from "../service";
import { GOAL_KEYS } from "./query-keys";
import type { Goal } from "../types";

// The read books filling a books-metric goal (count + recent covers).
// Enabled only for books-metric goals. Returns the ContributingMedia shape so the
// Goal detail gallery renders identically to the watching one.
export function useGoalContributingBooks(goal: Goal | undefined) {
  return useQuery({
    queryKey: [...GOAL_KEYS.detail(goal?.id ?? ""), "contributing-books"],
    queryFn: () => getGoalContributingBooks(goal!),
    enabled: !!goal && goal.metric_module === "books",
    staleTime: 60 * 1000,
  });
}
