"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRealtimeSync } from "@/shared/hooks/useRealtimeSync";
import { GOAL_KEYS, LINKED_TASK_KEYS, LINKED_HABIT_KEYS, MILESTONE_KEYS } from "./query-keys";

export function useRealtimeGoals(goalId?: string, linkedHabitIds: string[] = []) {
  const queryClient = useQueryClient();

  // Watch goals table — used on both list page and detail page
  useRealtimeSync({
    channelName: "goals-changes",
    table: "goals",
    onchange: () => {
      queryClient.invalidateQueries({ queryKey: GOAL_KEYS.all });
    },
  });

  // Watch tasks linked to this goal — detail page only
  // No server-side filter: client-side goal_id check is more reliable for UPDATE events
  useRealtimeSync({
    channelName: `linked-tasks-${goalId ?? "none"}`,
    table: "tasks",
    enabled: !!goalId,
    onchange: (payload) => {
      if (!goalId) return;
      const taskGoalId = (
        (payload.new as Record<string, unknown>)?.goal_id ??
        (payload.old as Record<string, unknown>)?.goal_id
      ) as string | undefined;
      if (taskGoalId === goalId) {
        queryClient.invalidateQueries({ queryKey: LINKED_TASK_KEYS.all });
        queryClient.invalidateQueries({ queryKey: GOAL_KEYS.all });
      }
    },
  });

  // Watch habits linked to this goal — detail page only
  useRealtimeSync({
    channelName: `linked-habits-${goalId ?? "none"}`,
    table: "habits",
    enabled: !!goalId,
    onchange: (payload) => {
      if (!goalId) return;
      const habitGoalId = (
        (payload.new as Record<string, unknown>)?.goal_id ??
        (payload.old as Record<string, unknown>)?.goal_id
      ) as string | undefined;
      if (habitGoalId === goalId) {
        queryClient.invalidateQueries({ queryKey: LINKED_HABIT_KEYS.all });
      }
    },
  });

  // Watch habit completions — updates completed_today / streak on linked habits
  // Filters by linkedHabitIds when available; falls back to always invalidate if IDs not yet loaded
  useRealtimeSync({
    channelName: `habit-completions-goal-${goalId ?? "none"}`,
    table: "habit_completions",
    enabled: !!goalId,
    onchange: (payload) => {
      if (!goalId) return;
      const habitId = (
        (payload.new as Record<string, unknown>)?.habit_id ??
        (payload.old as Record<string, unknown>)?.habit_id
      ) as string | undefined;
      if (!habitId || !linkedHabitIds.length || linkedHabitIds.includes(habitId)) {
        queryClient.invalidateQueries({ queryKey: LINKED_HABIT_KEYS.all });
      }
    },
  });

  // Watch milestones — detail page only
  // REPLICA IDENTITY FULL is set on goal_milestones, so payload.old carries goal_id on DELETE
  useRealtimeSync({
    channelName: `milestones-${goalId ?? "none"}`,
    table: "goal_milestones",
    enabled: !!goalId,
    onchange: (payload) => {
      if (!goalId) return;
      const milestoneGoalId = (
        (payload.new as Record<string, unknown>)?.goal_id ??
        (payload.old as Record<string, unknown>)?.goal_id
      ) as string | undefined;
      if (!milestoneGoalId || milestoneGoalId === goalId) {
        queryClient.invalidateQueries({ queryKey: MILESTONE_KEYS.all });
      }
    },
  });
}
