import { useQuery, useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import * as TaskService from "../service";
import * as GoalService from "@/modules/goals/service";
import { TASK_KEYS, STATUS_KEYS } from "./query-keys";
import { PROJECT_ASSIGNEE_KEYS } from "./useOrgMembers";
import { GOAL_KEYS, LINKED_TASK_KEYS } from "@/modules/goals/hooks/query-keys";
import type { MoveTaskInput, Status, Assignee } from "../types";
import type { Task } from "../types";
import { toast } from "@/shared/utils/toast";
import { markOptimistic, clearOptimistic } from "./optimistic-tracker";

// =====================================================
// HELPER: recalcGoalIfAuto
// Audit §3.2 v2 — RPC returns the new progress (0-100) or -1 if manual mode.
// Caller skips cache invalidation on -1. Single round-trip, no separate mode check.
// =====================================================

async function recalcGoalIfAuto(queryClient: QueryClient, goalId: string) {
  let newProgress: number;
  try {
    newProgress = await GoalService.recalculateProgress(goalId);
  } catch {
    return;
  }
  if (newProgress >= 0) {
    queryClient.invalidateQueries({ queryKey: GOAL_KEYS.detail(goalId) });
    queryClient.invalidateQueries({ queryKey: GOAL_KEYS.lists() });
  }
  queryClient.invalidateQueries({ queryKey: LINKED_TASK_KEYS.byGoal(goalId) });
}

// =====================================================
// HOOK: useTasks (fetch)
// =====================================================

export function useTasks(projectId: string | null) {
  return useQuery({
    queryKey: TASK_KEYS.byProject(projectId || ""),
    queryFn: () => TaskService.getTasks(projectId!),
    enabled: !!projectId,
    // Real-time WS is the primary freshness mechanism; staleTime is the safety net if WS drops (perf.md §2.2)
    staleTime: 1000 * 60 * 10, // 10 minutes
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
      console.error("[useCreateTask]", error);
      toast.error("Couldn't create task. Try again.");
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

      // Resolve joined fields from cache BEFORE patching — otherwise spreading
      // {...task, ...updatedTask} with only IDs erases task.status / task.assignee
      // and TaskCard renders undefined for 200-500ms (flash). Audit §1.4.
      const statuses = queryClient.getQueryData<Status[]>(STATUS_KEYS.byProject(updatedTask.project_id));
      const members = queryClient.getQueryData<Assignee[]>(PROJECT_ASSIGNEE_KEYS.byProject(updatedTask.project_id));
      const newStatus = updatedTask.status_id ? statuses?.find((s) => s.id === updatedTask.status_id) : undefined;
      const newAssignee = updatedTask.assignee_id !== undefined
        ? (updatedTask.assignee_id === null ? null : (members?.find((m) => m.id === updatedTask.assignee_id) ?? null))
        : undefined;

      // Optimistically update to the new value
      queryClient.setQueryData<Task[]>(TASK_KEYS.byProject(updatedTask.project_id), (old) => {
        if (!old) return old;
        return old.map((task) => {
          if (task.id !== updatedTask.id) return task;
          return {
            ...task,
            ...updatedTask,
            // Preserve resolved joins (or keep existing if not changed)
            status: newStatus ?? task.status,
            assignee: newAssignee !== undefined ? newAssignee : task.assignee,
            // tags don't change via updateTask — explicit useTags mutations handle them
          };
        });
      });

      return { previousTasks };
    },
    onError: (error: Error, updatedTask, context) => {
      // Rollback on error
      if (context?.previousTasks) {
        queryClient.setQueryData(TASK_KEYS.byProject(updatedTask.project_id), context.previousTasks);
      }
      console.error("[useUpdateTask]", error);
      toast.error("Couldn't update task. Try again.");
    },
    onSuccess: async (updatedTask) => {
      queryClient.invalidateQueries({ queryKey: TASK_KEYS.byProject(updatedTask.project_id) });
      if (updatedTask.goal_id) {
        await recalcGoalIfAuto(queryClient, updatedTask.goal_id);
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
      queryClient.setQueryData<Task[]>(TASK_KEYS.byProject(projectId), (old) => {
        if (!old) return old;
        return old.map((task) =>
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
      console.error("[useMoveTask]", error);
      toast.error("Couldn't move task. Try again.");
    },
    onSettled: (_data, _err, variables) => {
      clearOptimistic(variables.taskId);
    },
    onSuccess: async (_, variables) => {
      const tasks = queryClient.getQueryData<Task[]>(TASK_KEYS.byProject(variables.projectId));
      const task  = tasks?.find((t) => t.id === variables.taskId);
      if (task?.goal_id) {
        await recalcGoalIfAuto(queryClient, task.goal_id);
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
        await recalcGoalIfAuto(queryClient, task.goal_id);
      }
    },
    onError: (error: Error) => {
      console.error("[useDeleteTask]", error);
      toast.error("Couldn't delete task. Try again.");
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
        await recalcGoalIfAuto(queryClient, task.goal_id);
      }
    },
    onError: (error: Error) => {
      console.error("[useArchiveTask]", error);
      toast.error("Couldn't archive task. Try again.");
    },
  });
}
