"use client";

import { useOrgStore } from "@/shared/stores/useOrgStore";
import { useQuery } from "@tanstack/react-query";
import { WATCHING_KEYS } from "./query-keys";
import { getWatchingStatsData, getRewatchStats } from "../service";

export function useWatchingStatsData(userId: string) {
  const orgId=useOrgStore(s=>s.orgId);
  return useQuery({
    queryKey: WATCHING_KEYS.stats(userId,orgId),
    queryFn: async () => {
      if (!orgId) throw new Error("Organization required");
      const [{ items, cours, history }, rewatches] = await Promise.all([
        getWatchingStatsData(userId,orgId),
        getRewatchStats(userId,orgId),
      ]);
      return { items, cours, rewatches, history };
    },
    enabled: !!userId && !!orgId,
  });
}
