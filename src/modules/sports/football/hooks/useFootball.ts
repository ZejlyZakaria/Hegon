import { useQuery } from "@tanstack/react-query";
import { getBestXI } from "../service";
import { FOOTBALL_KEYS } from "./query-keys";

// The user's Best XI (dream-team). Replaces the old getFootballPageData monolith — the page's other
// surfaces (Following, Upcoming, Recent, Standings, Fan Log) each load on their own hooks now, so this
// only fetches the two Best XI tables instead of ~11 queries whose result was thrown away.
export function useBestXI(userId: string | null) {
  return useQuery({
    queryKey: FOOTBALL_KEYS.bestXi(),
    queryFn: () => getBestXI(userId!),
    enabled: !!userId,
    staleTime: 1000 * 60 * 10,
  });
}
