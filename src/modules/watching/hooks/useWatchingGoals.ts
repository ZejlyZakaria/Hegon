import { useQuery, queryOptions } from "@tanstack/react-query";
import { getActiveWatchingGoals } from "@/modules/goals/service";
import { GOAL_KEYS } from "@/modules/goals/hooks/query-keys";
import { STALE } from "@/shared/lib/stale";

// Active watching-metric goals. Keyed under GOAL_KEYS so syncWatchingGoals'
// invalidation (GOAL_KEYS.all) also refreshes the Watching-side surfaces live.
//
// ONE definition, two ways in. The surfaces that SHOW goals (Stats, "Contributing to") subscribe
// with the hook. The single writer (`useWatchActions`) only needs them at the instant a title is
// marked watched — to animate the counter — so it reads them on demand with `fetchQuery` on the
// same options. It used to subscribe too, and since the writer is mounted on every poster card,
// the whole grid page paid a goals fetch (plus one count per goal) before anyone touched anything:
// the "mount cascade" measured in phase 2 (`goals` at 1 157 ms, three HEAD counts at ~1 500 ms).
export const watchingGoalsQuery = () =>
  queryOptions({
    queryKey: [...GOAL_KEYS.lists(), "watching"],
    queryFn: getActiveWatchingGoals,
    staleTime: STALE.MINUTE,
  });

export function useWatchingGoals(enabled = true) {
  return useQuery({ ...watchingGoalsQuery(), enabled });
}
