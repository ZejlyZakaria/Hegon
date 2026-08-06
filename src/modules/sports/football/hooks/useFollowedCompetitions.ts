import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getFollowedCompetitions, followCompetition, unfollowCompetition } from "../service";
import { FOOTBALL_KEYS } from "./query-keys";

// The competitions the user follows (the 2nd axis). Its own query.
export function useFollowedCompetitions(userId: string | null) {
  return useQuery({
    queryKey: FOOTBALL_KEYS.followedCompetitions(),
    queryFn: () => getFollowedCompetitions(userId!),
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
  });
}

// Follow a competition + populate its whole-season calendar into football_matches right away
// (one football-data call). Best-effort sync: never block the follow on it.
export function useFollowCompetition(userId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ competitionId, apiExternalId }: { competitionId: string; apiExternalId: string | null }) => {
      await followCompetition(userId!, competitionId);
      if (apiExternalId) {
        try {
          await fetch(`/api/football/sync-competition/${apiExternalId}`, { method: "POST" });
        } catch { /* non-blocking — the cron will catch up */ }
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: FOOTBALL_KEYS.followedCompetitions() }),
  });
}

export function useUnfollowCompetition(userId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (competitionId: string) => unfollowCompetition(userId!, competitionId),
    onSuccess: () => qc.invalidateQueries({ queryKey: FOOTBALL_KEYS.followedCompetitions() }),
  });
}
