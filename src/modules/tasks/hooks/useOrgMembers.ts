import { useQuery } from "@tanstack/react-query";
import * as TaskService from "../service";

export const ORG_MEMBER_KEYS = {
  all: ["org-members"] as const,
};

export const PROJECT_ASSIGNEE_KEYS = {
  all: ["project-assignees"] as const,
  byProject: (projectId: string) => [...PROJECT_ASSIGNEE_KEYS.all, projectId] as const,
};

export function useOrgMembers() {
  return useQuery({
    queryKey: ORG_MEMBER_KEYS.all,
    queryFn: TaskService.getOrgMembers,
    staleTime: 1000 * 60 * 10,
  });
}

export function useProjectAssignees(projectId: string | null) {
  return useQuery({
    queryKey: PROJECT_ASSIGNEE_KEYS.byProject(projectId ?? ""),
    queryFn: () => TaskService.getProjectAssignees(projectId!),
    enabled: !!projectId,
    staleTime: 1000 * 60 * 5,
  });
}
