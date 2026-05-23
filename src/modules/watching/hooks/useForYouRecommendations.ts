import { useQuery } from "@tanstack/react-query";
import { getForYouRecommendations } from "@/modules/watching/service";
import { TMDB_KEYS } from "./query-keys";
import type { MediaType } from "@/modules/watching/types";

export function useForYouRecommendations(userId: string, type: MediaType) {
  return useQuery({
    queryKey: TMDB_KEYS.forYou(type),
    queryFn: () => getForYouRecommendations(userId, type),
    staleTime: 1000 * 60 * 60 * 24,  // 24h — seeds rotate on next day's fetch
    gcTime: 1000 * 60 * 60 * 48,
    refetchOnWindowFocus: false,
    enabled: !!userId,
  });
}
