import { useQuery } from "@tanstack/react-query";
import { getTasksActivityByDay } from "../service";

export function useWeeklyActivity(fromDate: string, toDate: string) {
  return useQuery({
    queryKey: ["dashboard", "weekly-tasks-activity", fromDate, toDate],
    queryFn: () => getTasksActivityByDay(fromDate, toDate),
    staleTime: 1000 * 60 * 5,
  });
}
