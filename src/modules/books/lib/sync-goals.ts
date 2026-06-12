import type { QueryClient } from "@tanstack/react-query";
import { recalcBooksGoals, type WatchingGoalDelta } from "@/modules/goals/service";
import { GOAL_KEYS } from "@/modules/goals/hooks/query-keys";

// Cross-module bridge: after a book change (read/unread, removal), recompute the
// user's books-metric goals and refresh the Goals UI (list, detail, contributing
// covers — all under GOAL_KEYS.all). Returns deltas for an optional ripple.
// Best-effort: the book change already succeeded, so a sync failure is swallowed.
export async function syncBooksGoals(queryClient: QueryClient): Promise<WatchingGoalDelta[]> {
  let deltas: WatchingGoalDelta[] = [];
  try {
    deltas = await recalcBooksGoals();
  } catch {
    /* non-fatal */
  }
  queryClient.invalidateQueries({ queryKey: GOAL_KEYS.all });
  return deltas;
}
