import { useQuery } from "@tanstack/react-query";
import { getF1PageData } from "../service";
import { F1_KEYS } from "./query-keys";
import { useCurrentUserId } from "@/shared/hooks/useCurrentUserId";

export function useF1Data() {
  const userId = useCurrentUserId();
  return useQuery({
    queryKey: F1_KEYS.page(),
    queryFn: () => getF1PageData(userId!),
    enabled: !!userId,
    staleTime: 1000 * 60 * 10,
  });
}
