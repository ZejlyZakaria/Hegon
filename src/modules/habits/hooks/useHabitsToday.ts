import { useQuery, useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import * as HabitService from "../service";
import { HABIT_KEYS } from "./query-keys";
import { GOAL_KEYS, LINKED_HABIT_KEYS } from "@/modules/goals/hooks/query-keys";
import { toast } from "@/shared/utils/toast";
import { useIsDemo } from "@/modules/settings/hooks/useSettings";
import { DemoReadOnlyError, handledDemoError } from "@/shared/utils/demo-guard";
import {
  getTodayStr,
  getYesterdayStr,
  isExpectedOnDate,
  isWeeklyAnyDay,
  weekStartStr,
  isWithinAnyPause,
  calcStreaks,
  streakWindowDays,
  type PausePeriod,
} from "../utils";
import type { Habit, HabitWithStatus, HabitCompletion, CompleteHabitInput } from "../types";

// Streaks scan the full completion history (sized by streakWindowDays), not a
// rolling window — otherwise any run longer than the window is silently capped.
const STREAK_FROM = "2000-01-01";

function isExpectedToday(habit: Habit): boolean {
  return isExpectedOnDate(habit, getTodayStr());
}

// ─── Main hook ────────────────────────────────────────────────────────────────

export function useHabitsToday() {
  const today     = getTodayStr();
  const yesterday = getYesterdayStr();

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
    queryKey: HABIT_KEYS.completionsRange('all', STREAK_FROM, today),
    queryFn:  () => HabitService.getCompletionsForHabits(habitIds, STREAK_FROM, today),
    enabled:  habitIds.length > 0,
    staleTime: 1000 * 60 * 5,
  });

  // skips/pauses degrade gracefully before the migration is applied (retry: false)
  const skipsQuery = useQuery({
    queryKey: HABIT_KEYS.skips(`all:${today}`),
    queryFn:  () => HabitService.getSkipsForHabits(habitIds, STREAK_FROM, today),
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
    queryKey: HABIT_KEYS.freezes(`all:${today}`),
    queryFn:  () => HabitService.getFreezesForHabits(habitIds, STREAK_FROM, today),
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

  // Scan back only as far as completions actually exist (honest, bounded).
  const earliestCompletion = recentCompletions.reduce(
    (min, c) => (c.completed_date < min ? c.completed_date : min),
    today,
  );
  const windowDays = streakWindowDays(earliestCompletion, today);

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
      windowDays,
    });

    // Weekly-any-day: "done" means a completion anywhere in the current week.
    let completedToday = todayDone.has(h.id);
    let weekCompletionDate: string | null = null;
    if (isWeeklyAnyDay(h)) {
      const wStart = weekStartStr(today);
      const inWeek = recentCompletions
        .filter((c) => c.habit_id === h.id && c.completed_date >= wStart && c.completed_date <= today)
        .map((c) => c.completed_date)
        .sort();
      completedToday = inWeek.length > 0;
      weekCompletionDate = inWeek.length ? inWeek[inWeek.length - 1] : null;
    }

    return {
      ...h,
      completed_today:  completedToday,
      week_completion_date: weekCompletionDate,
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
  // Weekly-any-day habits aren't tied to a weekday → they'd never show in Today.
  // They get their own always-visible "This Week" section (status = this week).
  const weeklyHabits = allStatus.filter((h) => isWeeklyAnyDay(h) && !h.is_paused);

  // Skipped habits are neutral — excluded from today's progress denominator.
  const activeToday    = todayHabits.filter((h) => !h.skipped_today);
  const completedCount = activeToday.filter((h) => h.completed_today).length;
  const totalCount     = activeToday.length;

  return {
    habits:            todayHabits,
    weeklyHabits,      // weekly-any-day habits → "This Week" section
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

type RangeRow = { habit_id: string; completed_date: string };

// Cross-module: if a habit is linked to a goal, refresh goal detail + linked habits.
function refreshLinkedGoal(queryClient: QueryClient, habitId: string) {
  const habits = queryClient.getQueryData<Habit[]>(HABIT_KEYS.lists());
  const habit  = habits?.find((h) => h.id === habitId);
  if (habit?.goal_id) {
    queryClient.invalidateQueries({ queryKey: GOAL_KEYS.detail(habit.goal_id) });
    queryClient.invalidateQueries({ queryKey: LINKED_HABIT_KEYS.byGoal(habit.goal_id) });
  }
}

export function useCompleteHabit() {
  const queryClient = useQueryClient();
  const today  = getTodayStr();
  const isDemo = useIsDemo();

  return useMutation({
    mutationFn: (input: CompleteHabitInput) => {
      if (isDemo) throw new DemoReadOnlyError();
      return HabitService.completeHabit(input);
    },
    // Optimistic: tick the checkbox and bump the streak instantly; roll back on error.
    onMutate: async (input) => {
      if (isDemo) return;  // demo is read-only — skip the optimistic flash
      const dayKey   = HABIT_KEYS.today(input.completed_date);
      const rangeKey = HABIT_KEYS.completionsRange('all', STREAK_FROM, today);
      await Promise.all([
        queryClient.cancelQueries({ queryKey: dayKey }),
        queryClient.cancelQueries({ queryKey: rangeKey }),
      ]);
      const prevDay   = queryClient.getQueryData<HabitCompletion[]>(dayKey);
      const prevRange = queryClient.getQueryData<RangeRow[]>(rangeKey);

      queryClient.setQueryData<HabitCompletion[]>(dayKey, (old) =>
        old && !old.some((c) => c.habit_id === input.habit_id)
          ? [...old, {
              id:             `optimistic-${input.habit_id}-${input.completed_date}`,
              habit_id:       input.habit_id,
              completed_date: input.completed_date,
              note:           input.note ?? null,
              created_at:     new Date().toISOString(),
            }]
          : old,
      );
      queryClient.setQueryData<RangeRow[]>(rangeKey, (old) =>
        old && !old.some((c) => c.habit_id === input.habit_id && c.completed_date === input.completed_date)
          ? [...old, { habit_id: input.habit_id, completed_date: input.completed_date }]
          : old,
      );

      return { prevDay, prevRange, dayKey, rangeKey };
    },
    onError: (err, _input, ctx) => {
      if (handledDemoError(err)) return;
      if (ctx) {
        queryClient.setQueryData(ctx.dayKey, ctx.prevDay);
        queryClient.setQueryData(ctx.rangeKey, ctx.prevRange);
      }
      toast.error("Failed to complete habit.");
    },
    onSuccess: (_, input) => refreshLinkedGoal(queryClient, input.habit_id),
    onSettled: (_d, _e, input) => {
      queryClient.invalidateQueries({ queryKey: HABIT_KEYS.today(input.completed_date) });
      queryClient.invalidateQueries({ queryKey: HABIT_KEYS.completionsRange('all', STREAK_FROM, today) });
      queryClient.invalidateQueries({ queryKey: [...HABIT_KEYS.all, 'heatmap'] });
    },
  });
}

export function useUncompleteHabit() {
  const queryClient = useQueryClient();
  const today  = getTodayStr();
  const isDemo = useIsDemo();

  return useMutation({
    mutationFn: ({ habitId, date }: { habitId: string; date: string }) => {
      if (isDemo) throw new DemoReadOnlyError();
      return HabitService.uncompleteHabit(habitId, date);
    },
    // Optimistic: untick + drop the streak day instantly; roll back on error.
    onMutate: async ({ habitId, date }) => {
      if (isDemo) return;  // demo is read-only — skip the optimistic flash
      const dayKey   = HABIT_KEYS.today(date);
      const rangeKey = HABIT_KEYS.completionsRange('all', STREAK_FROM, today);
      await Promise.all([
        queryClient.cancelQueries({ queryKey: dayKey }),
        queryClient.cancelQueries({ queryKey: rangeKey }),
      ]);
      const prevDay   = queryClient.getQueryData<HabitCompletion[]>(dayKey);
      const prevRange = queryClient.getQueryData<RangeRow[]>(rangeKey);

      queryClient.setQueryData<HabitCompletion[]>(dayKey, (old) =>
        old ? old.filter((c) => c.habit_id !== habitId) : old,
      );
      queryClient.setQueryData<RangeRow[]>(rangeKey, (old) =>
        old ? old.filter((c) => !(c.habit_id === habitId && c.completed_date === date)) : old,
      );

      return { prevDay, prevRange, dayKey, rangeKey };
    },
    onError: (err, _vars, ctx) => {
      if (handledDemoError(err)) return;
      if (ctx) {
        queryClient.setQueryData(ctx.dayKey, ctx.prevDay);
        queryClient.setQueryData(ctx.rangeKey, ctx.prevRange);
      }
      toast.error("Failed to undo completion.");
    },
    onSuccess: (_, { habitId }) => refreshLinkedGoal(queryClient, habitId),
    onSettled: (_d, _e, { date }) => {
      queryClient.invalidateQueries({ queryKey: HABIT_KEYS.today(date) });
      queryClient.invalidateQueries({ queryKey: HABIT_KEYS.completionsRange('all', STREAK_FROM, today) });
      queryClient.invalidateQueries({ queryKey: [...HABIT_KEYS.all, 'heatmap'] });
    },
  });
}
