/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as TaskService from "../service";
import { TASK_KEYS } from "./query-keys";
import type { MoveTaskInput } from "../types";
import { toast } from "@/shared/utils/toast";

// =====================================================
// HOOK: useTasks (fetch)
// =====================================================

export function useTasks(projectId: string | null) {
  return useQuery({
    queryKey: TASK_KEYS.byProject(projectId || ""),
    queryFn: () => TaskService.getTasks(projectId!),
    enabled: !!projectId,
    staleTime: 1000 * 60 * 3, // 3 minutes
  });
}

// =====================================================
// HOOK: useCreateTask (mutation)
// =====================================================

export function useCreateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: TaskService.createTask,
    onSuccess: (newTask) => {
      queryClient.invalidateQueries({ queryKey: TASK_KEYS.byProject(newTask.project_id) });
      toast.success("Task created successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to create task: ${error.message}`);
    },
  });
}

// =====================================================
// HOOK: useUpdateTask (mutation)
// =====================================================

export function useUpdateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: TaskService.updateTask,
    onMutate: async (updatedTask) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: TASK_KEYS.byProject(updatedTask.project_id) });

      // Snapshot previous value
      const previousTasks = queryClient.getQueryData(TASK_KEYS.byProject(updatedTask.project_id));

      // Optimistically update to the new value
      queryClient.setQueryData(TASK_KEYS.byProject(updatedTask.project_id), (old: any) => {
        if (!old) return old;
        return old.map((task: any) =>
          task.id === updatedTask.id ? { ...task, ...updatedTask } : task
        );
      });

      return { previousTasks };
    },
    onError: (error: Error, updatedTask, context) => {
      // Rollback on error
      if (context?.previousTasks) {
        queryClient.setQueryData(TASK_KEYS.byProject(updatedTask.project_id), context.previousTasks);
      }
      toast.error(`Failed to update task: ${error.message}`);
    },
    onSuccess: (updatedTask) => {
      queryClient.invalidateQueries({ queryKey: TASK_KEYS.byProject(updatedTask.project_id) });
      toast.success("Task updated");
    },
  });
}

// =====================================================
// HOOK: useMoveTask (drag & drop mutation)
// =====================================================

export function useMoveTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: TaskService.moveTask,
    // Synchrone (pas d'async/await) — s'exécute dans le même tick que mutate()
    // React batchera setActiveTask(null) + setQueryData dans le même render
    // → zéro flash de la carte à son ancienne position
    onMutate: ({ taskId, newStatusId, newPosition, projectId }: MoveTaskInput) => {
      // Fire-and-forget cancel (pas d'await — évite de rendre onMutate async)
      queryClient.cancelQueries({ queryKey: TASK_KEYS.byProject(projectId) });

      // Snapshot pour rollback
      const previousTasks = queryClient.getQueryData(TASK_KEYS.byProject(projectId));

      // Optimistic update — synchrone
      queryClient.setQueryData(TASK_KEYS.byProject(projectId), (old: any) => {
        if (!old) return old;
        return old.map((task: any) =>
          task.id === taskId
            ? { ...task, status_id: newStatusId, position: newPosition }
            : task
        );
      });

      return { previousTasks };
    },
    onError: (error: Error, variables, context) => {
      // Rollback
      if (context?.previousTasks) {
        queryClient.setQueryData(TASK_KEYS.byProject(variables.projectId), context.previousTasks);
      }
      toast.error(`Failed to move task`);
    },
    // Pas d'onSettled — pas de refetch après move = pas de second snap-back
  });
}

// =====================================================
// HOOK: useDeleteTask (mutation)
// =====================================================

export function useDeleteTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId }: { taskId: string; projectId: string }) => TaskService.deleteTask(taskId),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: TASK_KEYS.byProject(variables.projectId) });
      toast.success("Task deleted");
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete task: ${error.message}`);
    },
  });
}

// =====================================================
// HOOK: useArchiveTask (mutation)
// =====================================================

export function useArchiveTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId }: { taskId: string; projectId: string }) => TaskService.archiveTask(taskId),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: TASK_KEYS.byProject(variables.projectId) });
      toast.success("Task archived");
    },
    onError: (error: Error) => {
      toast.error(`Failed to archive task: ${error.message}`);
    },
  });
}