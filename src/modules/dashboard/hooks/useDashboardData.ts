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
    // The dashboard is a "home" you return to after acting elsewhere (watching an
    // episode, completing a task…). Always revalidate on arrival so it's never
    // stale — the cached data still shows instantly, then updates (SWR).
    refetchOnMount: "always",
  });
}
