import { useQuery } from "@tanstack/react-query";
import * as GoalService from "../service";
import { GOAL_KEYS } from "./query-keys";
import type { Goal } from "../types";

// The Momentum sparkline's data source depends on the goal type:
//  • manual goals → deliberate progress snapshots (the snapshot trigger).
//  • auto goals (tasks OR metric watching/books) → reconstructed RETROACTIVELY from
//    the real event dates (completed_at / watched_at / finished_at), because their
//    `progress` can be re-synced any day, which would make the snapshot misleading —
//    and because events carry their own dates, this works for goals that predate
//    the feature.
// Keyed under detail(id) so a goal-detail invalidation refetches it.
export function useGoalMomentum(goal: Goal | undefined) {
  const isAuto = goal?.progress_mode === "auto";
  return useQuery({
    queryKey: [...GOAL_KEYS.progressHistory(goal?.id ?? ""), isAuto ? "activity" : "snapshot"],
    queryFn:  () =>
      isAuto
        ? GoalService.getGoalActivityMomentum(goal!)
        : GoalService.getGoalProgressHistory(goal!.id),
    enabled:  !!goal,
    staleTime: 1000 * 60,
  });
}
