"use client";

import { useQuery } from "@tanstack/react-query";
import { WATCHING_KEYS } from "./query-keys";
import { getWatchingStatsData, getRewatchStats } from "../service";

export function useWatchingStatsData(userId: string) {
  return useQuery({
    queryKey: WATCHING_KEYS.stats(userId),
    queryFn: async () => {
      const [{ items, cours, history }, rewatches] = await Promise.all([
        getWatchingStatsData(userId),
        getRewatchStats(userId),
      ]);
      return { items, cours, rewatches, history };
    },
    enabled: !!userId,
  });
}
