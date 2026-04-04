import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/infrastructure/supabase/client";
import * as TaskService from "../service";
import { WORKSPACE_KEYS } from "./query-keys";

// =====================================================
// HOOK: useWorkspaces
// =====================================================

export function useWorkspaces(userId?: string) {
  return useQuery({
    queryKey: WORKSPACE_KEYS.lists(),
    queryFn: async () => {
      const id = userId || (await createClient().auth.getUser()).data.user?.id || "";
      return TaskService.getWorkspaces(id);
    },
    enabled: userId !== undefined ? !!userId : true,
    staleTime: 1000 * 60 * 10, // 10 minutes (workspaces don't change often)
  });
}