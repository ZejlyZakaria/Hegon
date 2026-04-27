import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as HabitService from "../service";
import { HABIT_KEYS } from "./query-keys";
import { toast } from "@/shared/utils/toast";
import {
  getTodayStr,
  getYesterdayStr,
  getDaysAgoStr,
  isExpectedOnDate,
  calcStreaks,
} from "../utils";
import type { Habit, HabitWithStatus, CompleteHabitInput } from "../types";

function isExpectedToday(habit: Habit): boolean {
  return isExpectedOnDate(habit, getTodayStr());
}

// ─── Main hook ────────────────────────────────────────────────────────────────

export function useHabitsToday() {
  const today     = getTodayStr();
  const yesterday = getYesterdayStr();
  const from90    = getDaysAgoStr(89);

  const habitsQuery = useQuery({
    queryKey: HABIT_KEYS.lists(),
    queryFn:  () => HabitService.getHabits(),
    staleTime: 1000 * 60 * 5,
  });

  const habits   = habitsQuery.data ?? [];
  const habitIds = habits.map((h) => h.id);

  const completionsQuery = useQuery({
    queryKey: HABIT_KEYS.today(today),
    queryFn:  () => HabitService.getDayCompletions(today, habitIds),
    enabled:  habitIds.length > 0,
    staleTime: 0,
  });

  const yesterdayQuery = useQuery({
    queryKey: HABIT_KEYS.today(yesterday),
    queryFn:  () => HabitService.getDayCompletions(yesterday, habitIds),
    enabled:  habitIds.length > 0,
    staleTime: 1000 * 60 * 10,
  });

  const recentQuery = useQuery({
    queryKey: HABIT_KEYS.completionsRange('all', from90, today),
    queryFn:  () => HabitService.getCompletionsForHabits(habitIds, from90, today),
    enabled:  habitIds.length > 0,
    staleTime: 1000 * 60 * 5,
  });

  const todayDone     = new Set((completionsQuery.data ?? []).map((c) => c.habit_id));
  const yesterdayDone = new Set((yesterdayQuery.data ?? []).map((c) => c.habit_id));

  const completionMap     = Object.fromEntries(
    (completionsQuery.data ?? []).map((c) => [c.habit_id, c.id])
  );
  const completionTimeMap = Object.fromEntries(
    (completionsQuery.data ?? []).map((c) => [c.habit_id, c.created_at])
  );
  const recentCompletions = recentQuery.data ?? [];

  const todayHabits: HabitWithStatus[] = habits
    .filter(isExpectedToday)
    .map((h) => {
      const { current, best } = calcStreaks(h.id, recentCompletions, h);
      return {
        ...h,
        completed_today:  todayDone.has(h.id),
        completion_id:    completionMap[h.id]     ?? null,
        completion_time:  completionTimeMap[h.id] ?? null,
        at_risk:          h.frequency === 'daily'
                          && !yesterdayDone.has(h.id)
                          && !todayDone.has(h.id)
                          && h.created_at.slice(0, 10) < yesterday,
        current_streak:   current,
        best_streak:      best,
      };
    });

  const completedCount = todayHabits.filter((h) => h.completed_today).length;
  const totalCount     = todayHabits.length;

  return {
    habits:            todayHabits,
    allHabits:         habits,
    recentCompletions,
    completedCount,
    totalCount,
    isLoading: habitsQuery.isLoading
               || completionsQuery.isLoading
               || yesterdayQuery.isLoading
               || recentQuery.isLoading,
    isError:   habitsQuery.isError || completionsQuery.isError,
  };
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export function useCompleteHabit() {
  const queryClient = useQueryClient();
  const today  = getTodayStr();
  const from90 = getDaysAgoStr(89);

  return useMutation({
    mutationFn: (input: CompleteHabitInput) => HabitService.completeHabit(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: HABIT_KEYS.today(today) });
      queryClient.invalidateQueries({ queryKey: HABIT_KEYS.completionsRange('all', from90, today) });
    },
    onError: () => {
      toast.error("Failed to complete habit.");
    },
  });
}

export function useUncompleteHabit() {
  const queryClient = useQueryClient();
  const today  = getTodayStr();
  const from90 = getDaysAgoStr(89);

  return useMutation({
    mutationFn: ({ habitId, date }: { habitId: string; date: string }) =>
      HabitService.uncompleteHabit(habitId, date),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: HABIT_KEYS.today(today) });
      queryClient.invalidateQueries({ queryKey: HABIT_KEYS.completionsRange('all', from90, today) });
    },
    onError: () => {
      toast.error("Failed to undo completion.");
    },
  });
}
