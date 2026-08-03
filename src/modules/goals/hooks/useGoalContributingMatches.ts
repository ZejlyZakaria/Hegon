import { useQuery } from "@tanstack/react-query";
import { getGoalContributingMatches } from "../service";
import { GOAL_KEYS } from "./query-keys";
import type { Goal } from "../types";

// The matches you've logged that fill a football-metric goal (count + recent). Enabled only for
// football-metric goals. Returns the ContributingMedia shape so the Goal detail grid renders them.
export function useGoalContributingMatches(goal: Goal | undefined) {
  return useQuery({
    queryKey: [...GOAL_KEYS.detail(goal?.id ?? ""), "contributing-matches"],
    queryFn: () => getGoalContributingMatches(goal!),
    enabled: !!goal && goal.metric_module === "football",
    staleTime: 60 * 1000,
  });
}
