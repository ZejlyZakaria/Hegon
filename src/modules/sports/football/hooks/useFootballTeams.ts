import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getFootballTeams, unfollowTeam, followTeam, searchTeams } from "../service";
import { FOOTBALL_KEYS } from "./query-keys";

// The user's followed teams (main + favourites), fetched independently — its own query so a section
// that only needs the follow list doesn't wait on the whole page monolith.
export function useFootballTeams(userId: string | null) {
  return useQuery({
    queryKey: FOOTBALL_KEYS.teams(),
    queryFn: () => getFootballTeams(userId!),
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
  });
}

// Remove a team from the follow list (Unfollow in the Team Panel).
export function useUnfollowTeam(userId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (teamId: string) => unfollowTeam(userId!, teamId),
    onSuccess: () => qc.invalidateQueries({ queryKey: FOOTBALL_KEYS.teams() }),
  });
}

// Search the reference table by name (add modal, Teams tab). Debounce the query upstream.
export function useTeamSearch(query: string) {
  return useQuery({
    queryKey: FOOTBALL_KEYS.teamSearch(query),
    queryFn: () => searchTeams(query),
    enabled: query.trim().length >= 2,
    staleTime: 1000 * 60 * 5,
  });
}

// Follow a team + fill its whole-season calendar right away (one football-data call). Best-effort
// sync — never block the follow on it (the cron catches up).
export function useFollowTeam(userId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ teamId, apiExternalId }: { teamId: string; apiExternalId: string }) => {
      await followTeam(userId!, teamId);
      // Fire-and-forget the season fill — never block the follow on a football-data round-trip.
      void fetch(`/api/football/sync-team/${apiExternalId}`, { method: "POST", keepalive: true }).catch(() => {});
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: FOOTBALL_KEYS.teams() }),
  });
}
