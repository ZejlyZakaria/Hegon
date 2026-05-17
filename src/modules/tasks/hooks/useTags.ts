import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as TaskService from "../service";
import { TAG_KEYS, TASK_KEYS, PROJECT_KEYS } from "./query-keys";
import { toast } from "@/shared/utils/toast";

export function useProjectWorkspaceId(projectId: string | null) {
  return useQuery({
    queryKey: [...PROJECT_KEYS.all, "workspace-id", projectId ?? ""] as const,
    queryFn: () => TaskService.getProjectWorkspaceId(projectId!),
    enabled: !!projectId,
    staleTime: 1000 * 60 * 30,
  });
}

export function useTags(workspaceId: string | null) {
  return useQuery({
    queryKey: TAG_KEYS.byWorkspace(workspaceId ?? ""),
    queryFn: () => TaskService.getTags(workspaceId!),
    enabled: !!workspaceId,
    staleTime: 1000 * 60 * 10,
  });
}

export function useTagsForProject(projectId: string | null) {
  const { data: workspaceId } = useProjectWorkspaceId(projectId);
  return useTags(workspaceId ?? null);
}

export function useCreateTag(workspaceId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ name, color }: { name: string; color: string }) =>
      TaskService.createTag(workspaceId!, name, color),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TAG_KEYS.byWorkspace(workspaceId ?? "") });
      toast.success("Tag created.");
    },
    onError: () => {
      toast.error("Failed to create tag.");
    },
  });
}

export function useDeleteTag(workspaceId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tagId: string) => TaskService.deleteTag(tagId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TAG_KEYS.byWorkspace(workspaceId ?? "") });
      queryClient.invalidateQueries({ queryKey: TASK_KEYS.all });
      toast("Tag deleted.");
    },
    onError: () => {
      toast.error("Failed to delete tag.");
    },
  });
}

export function useUpdateTag(workspaceId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tagId, updates }: { tagId: string; updates: { name?: string; color?: string } }) =>
      TaskService.updateTag(tagId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TAG_KEYS.byWorkspace(workspaceId ?? "") });
      queryClient.invalidateQueries({ queryKey: TASK_KEYS.all });
    },
    onError: () => {
      toast.error("Failed to update tag.");
    },
  });
}

export function useAddTagToTask(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, tagId }: { taskId: string; tagId: string }) =>
      TaskService.addTagToTask(taskId, tagId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TASK_KEYS.byProject(projectId) });
    },
    onError: () => {
      toast.error("Failed to add tag.");
    },
  });
}

export function useRemoveTagFromTask(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, tagId }: { taskId: string; tagId: string }) =>
      TaskService.removeTagFromTask(taskId, tagId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TASK_KEYS.byProject(projectId) });
    },
    onError: () => {
      toast.error("Failed to remove tag.");
    },
  });
}
