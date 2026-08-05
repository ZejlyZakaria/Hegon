import { useQuery } from "@tanstack/react-query";
import { getTennisPageData } from "../service";
import { TENNIS_KEYS } from "./query-keys";
import { useCurrentUserId } from "@/shared/hooks/useCurrentUserId";

export function useTennisData() {
  const userId = useCurrentUserId();
  return useQuery({
    queryKey: TENNIS_KEYS.page(),
    queryFn: () => getTennisPageData(userId!),
    enabled: !!userId,
    staleTime: 1000 * 60 * 10,
  });
}
