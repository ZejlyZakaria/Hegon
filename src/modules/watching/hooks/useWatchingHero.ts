import { useQuery } from "@tanstack/react-query";
import { TMDB_KEYS } from "./query-keys";
import { getWatchingHeroData } from "../service";
import type { MediaType } from "../types";
import { STALE } from "@/shared/lib/stale";

export function useWatchingHero(type: MediaType) {
  return useQuery({
    queryKey: TMDB_KEYS.hero(type),
    queryFn: () => getWatchingHeroData(type),
    staleTime: STALE.HALF_HOUR,         // 30min — cheap DB read; the list only changes on the daily cron
    gcTime: 1000 * 60 * 60 * 24,
    refetchOnWindowFocus: false,
  });
}
