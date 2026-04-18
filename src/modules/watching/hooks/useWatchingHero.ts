import { useQuery } from "@tanstack/react-query";
import { WATCHING_KEYS } from "./query-keys";
import { getWatchingHeroData } from "../service";
import type { MediaType } from "../types";

export function useWatchingHero(type: MediaType) {
  return useQuery({
    queryKey: WATCHING_KEYS.hero(type),
    queryFn: () => getWatchingHeroData(type),
    staleTime: 1000 * 60 * 60,
    gcTime: 1000 * 60 * 60 * 2,
  });
}
