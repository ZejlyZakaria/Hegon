import { useQuery } from "@tanstack/react-query";
import { getTeamByExternalId, getTeamMatches } from "../service";
import { FOOTBALL_KEYS } from "./query-keys";

// The team record (meta: founded/venue/country/colours) — Team page header.
export function useTeam(externalId: string | null | undefined) {
  return useQuery({
    queryKey: FOOTBALL_KEYS.teamFull(externalId ?? ""),
    queryFn: () => getTeamByExternalId(externalId!),
    enabled: !!externalId,
    staleTime: 1000 * 60 * 30,
  });
}

// All the team's stored matches — the page derives its stats from these (grouped by season).
export function useTeamMatches(externalId: string | null | undefined) {
  return useQuery({
    queryKey: FOOTBALL_KEYS.teamMatches(externalId ?? ""),
    queryFn: () => getTeamMatches(externalId!),
    enabled: !!externalId,
    staleTime: 1000 * 60 * 5,
  });
}
