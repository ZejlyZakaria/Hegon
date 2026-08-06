import { useQuery } from "@tanstack/react-query";
import { getStandings, getCompetitionMatches } from "../service";
import { FOOTBALL_KEYS } from "./query-keys";

// The league table of a competition (Competition page / Standings section). Its own query.
export function useStandings(competitionId: string | null | undefined) {
  return useQuery({
    queryKey: FOOTBALL_KEYS.standings(competitionId ?? ""),
    queryFn: () => getStandings(competitionId!),
    enabled: !!competitionId,
    staleTime: 1000 * 60 * 10,
  });
}

// All stored matches of a competition (Competition page). Its own query.
export function useCompetitionMatches(competitionId: string | null | undefined) {
  return useQuery({
    queryKey: FOOTBALL_KEYS.competitionMatches(competitionId ?? ""),
    queryFn: () => getCompetitionMatches(competitionId!),
    enabled: !!competitionId,
    staleTime: 1000 * 60 * 5,
  });
}
