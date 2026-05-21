import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as TaskService from "../service";
import { STATUS_KEYS } from "./query-keys";
import { toast } from "@/shared/utils/toast";
import type { StatusType } from "../types";

export function useStatuses(projectId: string | null) {
  return useQuery({
    queryKey: STATUS_KEYS.byProject(projectId || ""),
    queryFn: () => TaskService.getStatuses(projectId!),
    enabled: !!projectId,
    staleTime: 1000 * 60 * 10,
  });
}

export function useCreateStatus(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; type: StatusType; color: string; icon: string | null; position: number }) =>
      TaskService.createStatus({ ...input, project_id: projectId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: STATUS_KEYS.byProject(projectId) });
      toast.success("Status created.");
    },
    onError: () => toast.error("Failed to create status."),
  });
}

export function useUpdateStatus(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<{ name: string; type: StatusType; color: string; icon: string | null }> }) =>
      TaskService.updateStatus(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: STATUS_KEYS.byProject(projectId) });
      toast.success("Status updated.");
    },
    onError: () => toast.error("Failed to update status."),
  });
}

export function useDeleteStatus(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => TaskService.deleteStatus(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: STATUS_KEYS.byProject(projectId) });
      toast.success("Status deleted.");
    },
    onError: () => toast.error("Cannot delete a status that has tasks assigned to it."),
  });
}

export function useReorderStatuses(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (updates: { id: string; position: number }[]) =>
      TaskService.reorderStatuses(updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: STATUS_KEYS.byProject(projectId) });
    },
  });
}
