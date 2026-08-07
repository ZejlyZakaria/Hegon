import { useQuery } from "@tanstack/react-query";
import { getStandings, getCompetitionMatches, getCompetitionById, getCompetitionSeason, getLiveStandings, getCompetitionWinners } from "../service";
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

// Season + progress (passthrough). Slow-moving → 1h client cache.
export function useCompetitionSeason(code: string | null | undefined) {
  return useQuery({
    queryKey: FOOTBALL_KEYS.competitionSeason(code ?? ""),
    queryFn: () => getCompetitionSeason(code!),
    enabled: !!code,
    staleTime: 1000 * 60 * 60,
  });
}

// Live league table (passthrough).
export function useLiveStandings(code: string | null | undefined) {
  return useQuery({
    queryKey: FOOTBALL_KEYS.liveStandings(code ?? ""),
    queryFn: () => getLiveStandings(code!),
    enabled: !!code,
    staleTime: 1000 * 60 * 30,
  });
}

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

// Roll of honour — Wikidata past winners (cached in DB). Slow-moving → long cache.
export function useCompetitionWinners(competitionId: string | null | undefined) {
  return useQuery({
    queryKey: FOOTBALL_KEYS.winners(competitionId ?? ""),
    queryFn: () => getCompetitionWinners(competitionId!),
    enabled: !!competitionId,
    staleTime: 1000 * 60 * 60,
  });
}
