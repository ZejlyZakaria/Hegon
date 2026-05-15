import { useQuery } from "@tanstack/react-query";
import * as TaskService from "../service";

export const ORG_MEMBER_KEYS = {
  all: ["org-members"] as const,
};

export function useOrgMembers() {
  return useQuery({
    queryKey: ORG_MEMBER_KEYS.all,
    queryFn: TaskService.getOrgMembers,
    staleTime: 1000 * 60 * 10,
  });
}
