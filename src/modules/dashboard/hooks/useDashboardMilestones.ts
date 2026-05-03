import { useQuery } from "@tanstack/react-query";
import { getDashboardMilestones } from "@/modules/goals/service";

export function useDashboardMilestones() {
  return useQuery({
    queryKey: ["dashboard", "milestones"],
    queryFn: () => getDashboardMilestones(),
    staleTime: 1000 * 60 * 5,
  });
}
