import { useQuery } from "@tanstack/react-query";
import { getTeamPersonalStats } from "../service";
import { FOOTBALL_KEYS } from "./query-keys";

// YOUR record for one team (matches watched / at the stadium / avg rating) — its own query,
// enabled once the panel knows the team's external id.
export function useTeamPersonalStats(userId: string | null, teamExternalId: string | null) {
  return useQuery({
    queryKey: FOOTBALL_KEYS.teamStats(teamExternalId ?? ""),
    queryFn: () => getTeamPersonalStats(userId!, teamExternalId!),
    enabled: !!userId && !!teamExternalId,
    staleTime: 1000 * 60 * 5,
  });
}
