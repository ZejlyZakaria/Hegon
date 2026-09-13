import { useQuery } from "@tanstack/react-query";
import { getForYouRecommendations } from "@/modules/watching/service";
import { TMDB_KEYS } from "./query-keys";
import type { MediaType } from "@/modules/watching/types";
import { STALE } from "@/shared/lib/stale";

export function useForYouRecommendations(userId: string, type: MediaType) {
  return useQuery({
    queryKey: TMDB_KEYS.forYou(type),
    queryFn: () => getForYouRecommendations(userId, type),
    // ROBOT DATA — the row is rewritten by the `watching-for-you-5d` cron, nothing else. The tier
    // used to be 30 min "because it is cheap", i.e. 240 refetches of a value that changes once
    // every five days. A day is the longest tier under the cadence; a manual refresh invalidates.
    staleTime: STALE.DAY,
    gcTime: STALE.DAY,
    enabled: !!userId,
  });
}
