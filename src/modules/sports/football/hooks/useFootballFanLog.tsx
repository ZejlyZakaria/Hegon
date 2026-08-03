import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getFootballFanLog,
  upsertFootballFanLog,
  deleteFootballFanLog,
} from "../service";
import { syncFootballGoals } from "../lib/sync-goals";
import { FOOTBALL_KEYS } from "./query-keys";
import { toast } from "@/shared/utils/toast";
import { GoalRippleToast } from "../components/GoalRippleToast";
import type { FanLogInput } from "../types";
import type { WatchingGoalDelta } from "@/modules/goals/service";

// A "+1" ripple for every football-metric goal whose progress just moved. Counts are derived from the
// recalc deltas (progress% × target) — the RPC already applied the counting rules (stadium / period),
// so a mere edit (unchanged count) yields no delta and no toast; only a genuine new match ripples.
function rippleGoals(deltas: WatchingGoalDelta[]) {
  for (const d of deltas) {
    if (d.newProgress <= d.oldProgress || !d.metric_target) continue;
    const target = d.metric_target;
    const oldCount = Math.round((d.oldProgress / 100) * target);
    const newCount = Math.round((d.newProgress / 100) * target);
    toast.custom(() => (
      <GoalRippleToast title={d.title} oldCount={oldCount} newCount={newCount} target={target} />
    ));
  }
}

// Your log for one match. The fiche is really "a match (world facts) + your row".
export function useFootballFanLog(userId: string, externalId: number) {
  return useQuery({
    queryKey: FOOTBALL_KEYS.fanLog(externalId),
    queryFn: () => getFootballFanLog(userId, externalId),
    enabled: !!userId && Number.isFinite(externalId) && externalId > 0,
  });
}

export function useUpsertFootballFanLog(userId: string, externalId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: FanLogInput) => upsertFootballFanLog(userId, input),
    onSuccess: async () => {
      qc.invalidateQueries({ queryKey: FOOTBALL_KEYS.fanLog(externalId) });
      // Cross-module: logging a match can move a football-metric goal → ripple it.
      rippleGoals(await syncFootballGoals(qc));
    },
  });
}

export function useDeleteFootballFanLog(userId: string, externalId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => deleteFootballFanLog(userId, externalId),
    onSuccess: async () => {
      qc.invalidateQueries({ queryKey: FOOTBALL_KEYS.fanLog(externalId) });
      // Unlogging can lower a goal — just refresh, no ripple.
      await syncFootballGoals(qc);
    },
  });
}
