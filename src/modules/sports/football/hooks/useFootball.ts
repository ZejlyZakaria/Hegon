import { useQuery } from "@tanstack/react-query";
import { getFootballPageData } from "../service";
import { FOOTBALL_KEYS } from "./query-keys";
import { useCurrentUserId } from "@/shared/hooks/useCurrentUserId";

export function useFootballData() {
  // Synchronous userId (localStorage, 0 network) — no more auth.getUser() round-trip gating the load.
  const userId = useCurrentUserId();
  return useQuery({
    queryKey: FOOTBALL_KEYS.page(),
    queryFn: () => getFootballPageData(userId!),
    enabled: !!userId,
    staleTime: 1000 * 60 * 10,
  });
}
