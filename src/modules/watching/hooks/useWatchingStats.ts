"use client";

import { useQuery } from "@tanstack/react-query";
import { WATCHING_KEYS } from "./query-keys";
import { getWatchingStatsData } from "../service";

export function useWatchingStatsData(userId: string) {
  return useQuery({
    queryKey: WATCHING_KEYS.stats(userId),
    queryFn: () => getWatchingStatsData(userId),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });
}
