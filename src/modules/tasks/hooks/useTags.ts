import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as TaskService from "../service";
import { TAG_KEYS, TASK_KEYS } from "./query-keys";
import { toast } from "@/shared/utils/toast";

// =====================================================
// HOOK: useTags
// =====================================================

export function useTags() {
  return useQuery({
    queryKey: TAG_KEYS.lists(),
    queryFn: () => TaskService.getTags(),
    staleTime: 1000 * 60 * 10,
  });
}

export function useCreateTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ name, color }: { name: string; color: string }) =>
      TaskService.createTag(name, color),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TAG_KEYS.lists() });
      toast.success("Tag created.");
    },
    onError: () => {
      toast.error("Failed to create tag.");
    },
  });
}

export function useDeleteTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tagId: string) => TaskService.deleteTag(tagId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TAG_KEYS.lists() });
      toast("Tag deleted.");
    },
    onError: () => {
      toast.error("Failed to delete tag.");
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
