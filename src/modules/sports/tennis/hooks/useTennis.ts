import { useQuery } from "@tanstack/react-query";
import { getTennisPageData } from "../service";
import { TENNIS_KEYS } from "./query-keys";
import { useCurrentUserId } from "@/shared/hooks/useCurrentUserId";
import { STALE } from "@/shared/lib/stale";

export function useTennisData() {
  const userId = useCurrentUserId();
  return useQuery({
    queryKey: TENNIS_KEYS.page(),
    queryFn: () => getTennisPageData(userId!),
    enabled: !!userId,
    staleTime: STALE.TEN_MINUTES,
  });
}
