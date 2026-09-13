import type { QueryClient } from "@tanstack/react-query";
import { reportError } from "@/shared/utils/report-error";
import { recalcWatchingGoals, type WatchingGoalDelta } from "@/modules/goals/service";
import { GOAL_KEYS } from "@/modules/goals/hooks/query-keys";

// Cross-module bridge: after a watch change, recompute the user's watching-metric
// goals and refresh the Goals UI (list, detail, contributing media — all under
// GOAL_KEYS.all). Returns the deltas so the detail page can show a "+1" ripple.
// Best-effort: the watch itself already succeeded, so a sync failure never fails the watch — but it
// is REPORTED (R8): a goal counter that silently stops moving is a bug the user discovers weeks later.
export async function syncWatchingGoals(queryClient: QueryClient): Promise<WatchingGoalDelta[]> {
  let deltas: WatchingGoalDelta[] = [];
  try {
    deltas = await recalcWatchingGoals();
  } catch (e) {
    reportError(e, { bridge: "watching→goals" });
  }
  queryClient.invalidateQueries({ queryKey: GOAL_KEYS.all });
  return deltas;
}
