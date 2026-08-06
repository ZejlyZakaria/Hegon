import { useQuery } from "@tanstack/react-query";
import { getScorers } from "../service";
import { FOOTBALL_KEYS } from "./query-keys";

// Top scorers of a competition (Competition page). Cached 1h client-side — scorers move slowly and
// the page is opened infrequently, so no DB table is needed.
export function useScorers(code: string | null | undefined) {
  return useQuery({
    queryKey: FOOTBALL_KEYS.scorers(code ?? ""),
    queryFn: () => getScorers(code!),
    enabled: !!code,
    staleTime: 1000 * 60 * 60,
  });
}
