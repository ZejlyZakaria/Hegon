import type { QueryClient } from "@tanstack/react-query";
import { recalcFootballGoals, type WatchingGoalDelta } from "@/modules/goals/service";
import { GOAL_KEYS } from "@/modules/goals/hooks/query-keys";

// Cross-module bridge: after a Fan Log change (a match logged / unlogged), recompute the user's
// football-metric goals and refresh the Goals UI (all under GOAL_KEYS.all). Best-effort — the log
// itself already succeeded, so a sync failure is swallowed.
export async function syncFootballGoals(queryClient: QueryClient): Promise<WatchingGoalDelta[]> {
  let deltas: WatchingGoalDelta[] = [];
  try {
    deltas = await recalcFootballGoals();
  } catch {
    /* non-fatal */
  }
  queryClient.invalidateQueries({ queryKey: GOAL_KEYS.all });
  return deltas;
}
