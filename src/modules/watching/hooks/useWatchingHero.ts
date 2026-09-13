import { useQuery } from "@tanstack/react-query";
import { TMDB_KEYS } from "./query-keys";
import { getWatchingHeroData } from "../service";
import type { MediaType } from "../types";
import { STALE } from "@/shared/lib/stale";

export function useWatchingHero(type: MediaType) {
  return useQuery({
    queryKey: TMDB_KEYS.hero(type),
    queryFn: () => getWatchingHeroData(type),
    // ROBOT DATA — `trending_cache` is filled once a day (`watching-trending-daily`, 05:15). The
    // tier follows the cron: a day. A tab left open across the refresh shows yesterday's rail
    // until it is reopened, which is the tolerance a "trending" signal has by nature.
    staleTime: STALE.DAY,
    gcTime: STALE.DAY,
  });
}
