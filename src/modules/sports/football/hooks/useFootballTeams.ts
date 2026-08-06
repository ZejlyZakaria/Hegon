import { useQuery } from "@tanstack/react-query";
import { getFootballTeams } from "../service";
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
