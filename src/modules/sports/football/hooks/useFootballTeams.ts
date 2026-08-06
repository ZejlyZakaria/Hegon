import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getFootballTeams, unfollowTeam } from "../service";
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

// Remove a team from the follow list (edit mode on the Following strip).
export function useUnfollowTeam(userId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (teamId: string) => unfollowTeam(userId!, teamId),
    onSuccess: () => qc.invalidateQueries({ queryKey: FOOTBALL_KEYS.teams() }),
  });
}
