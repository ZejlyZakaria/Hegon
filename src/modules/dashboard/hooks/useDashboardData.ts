import { useQuery } from "@tanstack/react-query";
import { getDashboardData } from "../service";

export const DASHBOARD_KEYS = {
  all: ["dashboard"] as const,
  data: () => [...DASHBOARD_KEYS.all, "data"] as const,
} as const;

export function useDashboardData() {
  return useQuery({
    queryKey: DASHBOARD_KEYS.data(),
    queryFn: () => getDashboardData(),
    staleTime: 1000 * 60 * 2,
  });
}
