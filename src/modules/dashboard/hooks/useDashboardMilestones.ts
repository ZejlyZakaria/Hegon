import { useQuery } from "@tanstack/react-query";
import { getGoals } from "@/modules/goals/service";

export function useDashboardMilestones() {
  return useQuery({
    queryKey: ["dashboard", "milestones"],
    queryFn: () => getGoals(),
    staleTime: 1000 * 60 * 5,
  });
}
