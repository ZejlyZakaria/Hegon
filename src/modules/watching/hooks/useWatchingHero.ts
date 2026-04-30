import { useQuery } from "@tanstack/react-query";
import { WATCHING_KEYS } from "./query-keys";
import { getWatchingHeroData } from "../service";
import type { MediaType } from "../types";

export function useWatchingHero(type: MediaType) {
  return useQuery({
    queryKey: WATCHING_KEYS.hero(type),
    queryFn: () => getWatchingHeroData(type),
    staleTime: 1000 * 60 * 60 * 24,   // 24h — TMDB trending doesn't change per session
    gcTime: 1000 * 60 * 60 * 48,       // 48h in memory
    refetchOnWindowFocus: false,
  });
}
