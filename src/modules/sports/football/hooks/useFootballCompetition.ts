import { useQuery } from "@tanstack/react-query";
import { getStandings, getCompetitionMatches, getCompetitionById, getCompetitionWinners } from "../service";
import { FOOTBALL_KEYS } from "./query-keys";

// The competition record (name, logo, code, brand colour) — Competition page header.
export function useCompetition(id: string | null | undefined) {
  return useQuery({
    queryKey: FOOTBALL_KEYS.competition(id ?? ""),
    queryFn: () => getCompetitionById(id!),
    enabled: !!id,
    staleTime: 1000 * 60 * 30,
  });
}

// The OFFICIAL league table of a competition (football_standings, cron-fed). Its own query.
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

// Roll of honour — Wikidata past winners (cached in DB). Slow-moving → long cache.
export function useCompetitionWinners(competitionId: string | null | undefined) {
  return useQuery({
    queryKey: FOOTBALL_KEYS.winners(competitionId ?? ""),
    queryFn: () => getCompetitionWinners(competitionId!),
    enabled: !!competitionId,
    staleTime: 1000 * 60 * 60,
  });
}
