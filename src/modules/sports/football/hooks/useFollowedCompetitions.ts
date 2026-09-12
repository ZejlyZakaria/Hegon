import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getFollowedCompetitions, getAllCompetitions, followCompetition, unfollowCompetition } from "../service";
import { FOOTBALL_KEYS } from "./query-keys";
import { STALE } from "@/shared/lib/stale";

// The competitions the user follows (the 2nd axis). Its own query.
export function useFollowedCompetitions(userId: string | null) {
  return useQuery({
    queryKey: FOOTBALL_KEYS.followedCompetitions(),
    queryFn: () => getFollowedCompetitions(userId!),
    enabled: !!userId,
  });
}

// All registered competitions (the 13) — the Competitions tab of the add modal.
export function useAllCompetitions() {
  return useQuery({
    queryKey: FOOTBALL_KEYS.allCompetitions(),
    queryFn: getAllCompetitions,
    staleTime: STALE.HALF_HOUR,
    gcTime: STALE.HALF_HOUR,
  });
}

// Follow a competition + populate its whole-season calendar into football_matches right away
// (one football-data call). Best-effort sync: never block the follow on it.
export function useFollowCompetition(userId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ competitionId, apiExternalId }: { competitionId: string; apiExternalId: string | null }) => {
      await followCompetition(userId!, competitionId);
      // Fire-and-forget the season fill — never block the toggle on a football-data round-trip.
      // `keepalive` lets it finish even if the modal closes right after. The cron backfills anyway.
      if (apiExternalId) {
        void fetch(`/api/football/sync-competition/${apiExternalId}`, { method: "POST", keepalive: true }).catch(() => {});
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
