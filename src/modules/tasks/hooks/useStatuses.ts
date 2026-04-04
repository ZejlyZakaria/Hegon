import { useQuery } from "@tanstack/react-query";
import * as TaskService from "../service";
import { STATUS_KEYS } from "./query-keys";

export function useStatuses(projectId: string | null) {
  return useQuery({
    queryKey: STATUS_KEYS.byProject(projectId || ""),
    queryFn: () => TaskService.getStatuses(projectId!),
    enabled: !!projectId,
    staleTime: 1000 * 60 * 10,
  });
}