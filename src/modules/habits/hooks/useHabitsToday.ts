import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as HabitService from "../service";
import { HABIT_KEYS } from "./query-keys";
import { GOAL_KEYS, LINKED_HABIT_KEYS } from "@/modules/goals/hooks/query-keys";
import { toast } from "@/shared/utils/toast";
import {
  getTodayStr,
  getYesterdayStr,
  getDaysAgoStr,
  isExpectedOnDate,
  isWithinAnyPause,
  calcStreaks,
  type PausePeriod,
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

  // skips/pauses degrade gracefully before the migration is applied (retry: false)
  const skipsQuery = useQuery({
    queryKey: HABIT_KEYS.skips(`all:${from90}:${today}`),
    queryFn:  () => HabitService.getSkipsForHabits(habitIds, from90, today),
    enabled:  habitIds.length > 0,
    staleTime: 1000 * 60 * 5,
    retry: false,
  });

  const pausesQuery = useQuery({
    queryKey: HABIT_KEYS.pauses('all'),
    queryFn:  () => HabitService.getPausesForHabits(habitIds),
    enabled:  habitIds.length > 0,
    staleTime: 1000 * 60 * 5,
    retry: false,
  });

  const freezesQuery = useQuery({
    queryKey: HABIT_KEYS.freezes(`all:${from90}:${today}`),
    queryFn:  () => HabitService.getFreezesForHabits(habitIds, from90, today),
    enabled:  habitIds.length > 0,
    staleTime: 1000 * 60 * 5,
    retry: false,
  });

  const todayDone     = new Set((completionsQuery.data ?? []).map((c) => c.habit_id));
  const yesterdayDone = new Set((yesterdayQuery.data ?? []).map((c) => c.habit_id));

  // skip dates per habit + pause periods per habit
  const skipsByHabit = new Map<string, Set<string>>();
  for (const s of skipsQuery.data ?? []) {
    const set = skipsByHabit.get(s.habit_id) ?? new Set<string>();
    set.add(s.skip_date);
    skipsByHabit.set(s.habit_id, set);
  }
  const pausesByHabit = new Map<string, PausePeriod[]>();
  for (const p of pausesQuery.data ?? []) {
    const arr = pausesByHabit.get(p.habit_id) ?? [];
    arr.push({ start: p.pause_start, end: p.pause_end });
    pausesByHabit.set(p.habit_id, arr);
  }
  const freezesByHabit = new Map<string, Set<string>>();
  for (const f of freezesQuery.data ?? []) {
    const set = freezesByHabit.get(f.habit_id) ?? new Set<string>();
    set.add(f.freeze_date);
    freezesByHabit.set(f.habit_id, set);
  }

  const completionMap     = Object.fromEntries(
    (completionsQuery.data ?? []).map((c) => [c.habit_id, c.id])
  );
  const completionTimeMap = Object.fromEntries(
    (completionsQuery.data ?? []).map((c) => [c.habit_id, c.created_at])
  );
  const recentCompletions = recentQuery.data ?? [];

  const buildStatus = (h: Habit): HabitWithStatus => {
    const skipSet = skipsByHabit.get(h.id) ?? new Set<string>();
    const freezeSet = freezesByHabit.get(h.id) ?? new Set<string>();
    const pausePeriods = pausesByHabit.get(h.id) ?? [];
    // skips and freezes are both neutral for streak purposes
    const neutral = skipSet.size || freezeSet.size
      ? new Set<string>([...skipSet, ...freezeSet])
      : skipSet;
    const { current, best } = calcStreaks(h.id, recentCompletions, h, {
      skipped: neutral,
      pauses: pausePeriods,
    });
    return {
      ...h,
      completed_today:  todayDone.has(h.id),
      completion_id:    completionMap[h.id]     ?? null,
      completion_time:  completionTimeMap[h.id] ?? null,
      at_risk:          h.frequency === 'daily'
                        && !yesterdayDone.has(h.id)
                        && !todayDone.has(h.id)
                        && !skipSet.has(yesterday)
                        && !freezeSet.has(yesterday)
                        && !isWithinAnyPause(yesterday, pausePeriods)
                        && h.created_at.slice(0, 10) < yesterday,
      skipped_today:    skipSet.has(today),
      is_paused:        isWithinAnyPause(today, pausePeriods),
      current_streak:   current,
      best_streak:      best,
    };
  };

  const allStatus = habits.map(buildStatus);
  // Today = scheduled today and not paused. Paused habits get their own list
  // (regardless of schedule) so they stay reachable to resume.
  const todayHabits  = allStatus.filter((h) => isExpectedToday(h) && !h.is_paused);
  const pausedHabits = allStatus.filter((h) => h.is_paused);

  // Skipped habits are neutral — excluded from today's progress denominator.
  const activeToday    = todayHabits.filter((h) => !h.skipped_today);
  const completedCount = activeToday.filter((h) => h.completed_today).length;
  const totalCount     = activeToday.length;

  return {
    habits:            todayHabits,
    pausedHabits,
    allStatus,         // every habit with computed status (for Stats overview)
    pausesByHabit,     // pause periods per habit (Stats neutralises paused days)
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
    onSuccess: (_, input) => {
      queryClient.invalidateQueries({ queryKey: HABIT_KEYS.today(today) });
      queryClient.invalidateQueries({ queryKey: HABIT_KEYS.completionsRange('all', from90, today) });
      queryClient.invalidateQueries({ queryKey: [...HABIT_KEYS.all, 'heatmap'] });

      // Cross-module: if this habit is linked to a goal, refresh goal detail + linked habits
      const habits = queryClient.getQueryData<Habit[]>(HABIT_KEYS.lists());
      const habit  = habits?.find((h) => h.id === input.habit_id);
      if (habit?.goal_id) {
        queryClient.invalidateQueries({ queryKey: GOAL_KEYS.detail(habit.goal_id) });
        queryClient.invalidateQueries({ queryKey: LINKED_HABIT_KEYS.byGoal(habit.goal_id) });
      }
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
    onSuccess: (_, { habitId }) => {
      queryClient.invalidateQueries({ queryKey: HABIT_KEYS.today(today) });
      queryClient.invalidateQueries({ queryKey: HABIT_KEYS.completionsRange('all', from90, today) });
      queryClient.invalidateQueries({ queryKey: [...HABIT_KEYS.all, 'heatmap'] });

      // Cross-module: if this habit is linked to a goal, refresh goal detail + linked habits
      const habits = queryClient.getQueryData<Habit[]>(HABIT_KEYS.lists());
      const habit  = habits?.find((h) => h.id === habitId);
      if (habit?.goal_id) {
        queryClient.invalidateQueries({ queryKey: GOAL_KEYS.detail(habit.goal_id) });
        queryClient.invalidateQueries({ queryKey: LINKED_HABIT_KEYS.byGoal(habit.goal_id) });
      }
    },
    onError: () => {
      toast.error("Failed to undo completion.");
    },
  });
}
