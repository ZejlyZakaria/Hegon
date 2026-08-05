import { useQuery } from "@tanstack/react-query";
import { getUpcomingMatches, getRecentMatches } from "../service";
import { FOOTBALL_KEYS } from "./query-keys";

// Independent match rails (read from football_matches). Each is its own query, enabled once we know
// the followed teams' external ids — no monolith waterfall (perf audit Finding 3).

export function useUpcomingMatches(teamExternalIds: string[]) {
  return useQuery({
    queryKey: FOOTBALL_KEYS.upcoming(teamExternalIds),
    queryFn: () => getUpcomingMatches(teamExternalIds),
    enabled: teamExternalIds.length > 0,
    staleTime: 1000 * 60 * 5,
  });
}

export function useRecentMatches(teamExternalIds: string[]) {
  return useQuery({
    queryKey: FOOTBALL_KEYS.recent(teamExternalIds),
    queryFn: () => getRecentMatches(teamExternalIds),
    enabled: teamExternalIds.length > 0,
    staleTime: 1000 * 60 * 5,
  });
}
