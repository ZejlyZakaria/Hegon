import { useQuery } from "@tanstack/react-query";
import { getFanLog } from "../service";
import { FOOTBALL_KEYS } from "./query-keys";

// The user's football diary — every match logged as watched, newest first. Own query.
export function useFanLog(userId: string | null) {
  return useQuery({
    queryKey: FOOTBALL_KEYS.fanLogList(),
    queryFn: () => getFanLog(userId!),
    enabled: !!userId,
    staleTime: 1000 * 60 * 2,
  });
}
