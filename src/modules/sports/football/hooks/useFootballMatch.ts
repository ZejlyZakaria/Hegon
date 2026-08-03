import { useQuery } from "@tanstack/react-query";
import { getFootballMatch } from "../service";
import { FOOTBALL_KEYS } from "./query-keys";

// One match, via the cache-aside route. A FINISHED match is immutable, so it can sit in cache for
// a long time; a live/upcoming one refreshes on its own cadence.
export function useFootballMatch(externalId: number) {
  return useQuery({
    queryKey: FOOTBALL_KEYS.match(externalId),
    queryFn: () => getFootballMatch(externalId),
    enabled: Number.isFinite(externalId) && externalId > 0,
    staleTime: 1000 * 60 * 10,
  });
}
