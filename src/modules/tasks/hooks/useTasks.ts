/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as TaskService from "../service";
import * as GoalService from "@/modules/goals/service";
import { TASK_KEYS } from "./query-keys";
import { GOAL_KEYS, LINKED_TASK_KEYS } from "@/modules/goals/hooks/query-keys";
import type { MoveTaskInput } from "../types";
import type { Task } from "../types";
import { toast } from "@/shared/utils/toast";
import { markOptimistic, clearOptimistic } from "./optimistic-tracker";

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
    onSuccess: async (updatedTask) => {
      queryClient.invalidateQueries({ queryKey: TASK_KEYS.byProject(updatedTask.project_id) });
      toast.success("Task updated");
      if (updatedTask.goal_id) {
        let goalMode = queryClient.getQueryData<{ progress_mode: string }>(GOAL_KEYS.detail(updatedTask.goal_id))?.progress_mode;
        if (!goalMode) {
          try { goalMode = (await GoalService.getGoal(updatedTask.goal_id)).progress_mode; } catch { /* ignore */ }
        }
        if (goalMode === "auto") {
          await GoalService.recalculateProgress(updatedTask.goal_id);
          queryClient.invalidateQueries({ queryKey: GOAL_KEYS.detail(updatedTask.goal_id) });
          queryClient.invalidateQueries({ queryKey: GOAL_KEYS.lists() });
        }
        queryClient.invalidateQueries({ queryKey: LINKED_TASK_KEYS.byGoal(updatedTask.goal_id) });
      }
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
      // Marque la task comme in-flight pour que useRealtimeTasks
      // n'invalide pas en réaction au self-echo postgres_changes.
      markOptimistic(taskId);

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
    onSettled: (_data, _err, variables) => {
      clearOptimistic(variables.taskId);
    },
    onSuccess: async (_, variables) => {
      const tasks = queryClient.getQueryData<Task[]>(TASK_KEYS.byProject(variables.projectId));
      const task  = tasks?.find((t) => t.id === variables.taskId);
      if (task?.goal_id) {
        let goalMode = queryClient.getQueryData<{ progress_mode: string }>(GOAL_KEYS.detail(task.goal_id))?.progress_mode;
        if (!goalMode) {
          try { goalMode = (await GoalService.getGoal(task.goal_id)).progress_mode; } catch { /* ignore */ }
        }
        if (goalMode === "auto") {
          await GoalService.recalculateProgress(task.goal_id);
          queryClient.invalidateQueries({ queryKey: GOAL_KEYS.detail(task.goal_id) });
          queryClient.invalidateQueries({ queryKey: GOAL_KEYS.lists() });
        }
        queryClient.invalidateQueries({ queryKey: LINKED_TASK_KEYS.byGoal(task.goal_id) });
      }
    },
    // Intentionally no invalidateQueries for TASK_KEYS — avoids snap-back animation after drag
  });
}

// =====================================================
// HOOK: useDeleteTask (mutation)
// =====================================================

export function useDeleteTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId }: { taskId: string; projectId: string }) => TaskService.deleteTask(taskId),
    onSuccess: async (_, variables) => {
      const tasks = queryClient.getQueryData<Task[]>(TASK_KEYS.byProject(variables.projectId));
      const task  = tasks?.find((t) => t.id === variables.taskId);
      queryClient.invalidateQueries({ queryKey: TASK_KEYS.byProject(variables.projectId) });
      toast.success("Task deleted");
      if (task?.goal_id) {
        let goalMode = queryClient.getQueryData<{ progress_mode: string }>(GOAL_KEYS.detail(task.goal_id))?.progress_mode;
        if (!goalMode) {
          try { goalMode = (await GoalService.getGoal(task.goal_id)).progress_mode; } catch { /* ignore */ }
        }
        if (goalMode === "auto") {
          await GoalService.recalculateProgress(task.goal_id);
          queryClient.invalidateQueries({ queryKey: GOAL_KEYS.detail(task.goal_id) });
          queryClient.invalidateQueries({ queryKey: GOAL_KEYS.lists() });
        }
        queryClient.invalidateQueries({ queryKey: LINKED_TASK_KEYS.byGoal(task.goal_id) });
      }
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
    onSuccess: async (_, variables) => {
      const tasks = queryClient.getQueryData<Task[]>(TASK_KEYS.byProject(variables.projectId));
      const task  = tasks?.find((t) => t.id === variables.taskId);
      queryClient.invalidateQueries({ queryKey: TASK_KEYS.byProject(variables.projectId) });
      toast.success("Task archived");
      if (task?.goal_id) {
        let goalMode = queryClient.getQueryData<{ progress_mode: string }>(GOAL_KEYS.detail(task.goal_id))?.progress_mode;
        if (!goalMode) {
          try { goalMode = (await GoalService.getGoal(task.goal_id)).progress_mode; } catch { /* ignore */ }
        }
        if (goalMode === "auto") {
          await GoalService.recalculateProgress(task.goal_id);
          queryClient.invalidateQueries({ queryKey: GOAL_KEYS.detail(task.goal_id) });
          queryClient.invalidateQueries({ queryKey: GOAL_KEYS.lists() });
        }
        queryClient.invalidateQueries({ queryKey: LINKED_TASK_KEYS.byGoal(task.goal_id) });
      }
    },
    onError: (error: Error) => {
      toast.error(`Failed to archive task: ${error.message}`);
    },
  });
}