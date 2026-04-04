import { useQuery } from "@tanstack/react-query";
import * as TaskService from "../service";
import { PROJECT_KEYS } from "./query-keys";

// =====================================================
// HOOK: useProjects
// =====================================================

export function useProjects(workspaceId: string | null) {
  return useQuery({
    queryKey: PROJECT_KEYS.byWorkspace(workspaceId!),
    queryFn: () => TaskService.getProjects(workspaceId!),
    enabled: !!workspaceId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}