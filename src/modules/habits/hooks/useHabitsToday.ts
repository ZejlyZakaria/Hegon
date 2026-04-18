import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as HabitService from "../service";
import { HABIT_KEYS } from "./query-keys";
import { toast } from "@/shared/utils/toast";
import type { Habit, HabitWithStatus, CompleteHabitInput } from "../types";

// ─── Date helpers ─────────────────────────────────────────────────────────────

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getTodayStr()     { return toDateStr(new Date()); }
function getYesterdayStr() { const d = new Date(); d.setDate(d.getDate() - 1); return toDateStr(d); }
function getDaysAgoStr(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return toDateStr(d); }

// ─── Frequency filter ─────────────────────────────────────────────────────────

function isExpectedToday(habit: Habit): boolean {
  if (habit.frequency === 'daily') return true;
  const todayDow = new Date().getDay(); // 0=Sun
  return habit.custom_days?.includes(todayDow) ?? false;
}

// ─── Streak calculations (from 60-day batch data — zero extra queries) ────────

type Completion = { habit_id: string; completed_date: string };

function calcStreaks(
  habitId: string,
  completions: Completion[],
  habit: Habit,
): { current: number; best: number } {
  const dates = completions
    .filter((c) => c.habit_id === habitId)
    .map((c) => c.completed_date)
    .sort(); // ascending

  if (dates.length === 0) return { current: 0, best: 0 };

  const dateSet = new Set(dates);

  if (habit.frequency === 'daily') {
    const today = getTodayStr();

    // ── current streak ──
    const start = dateSet.has(today) ? 0 : 1;
    let current = 0;
    for (let i = start; i < 90; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      if (dateSet.has(toDateStr(d))) current++;
      else break;
    }

    // ── best streak over the available 60 days ──
    let best = 0;
    let run  = 0;
    for (let i = 0; i < dates.length; i++) {
      if (i === 0) {
        run = 1;
      } else {
        const prev = new Date(dates[i - 1]);
        prev.setDate(prev.getDate() + 1);
        run = prev.toISOString().slice(0, 10) === dates[i] ? run + 1 : 1;
      }
      if (run > best) best = run;
    }

    return { current, best };
  }

  // weekly / custom: simple count for V1
  return { current: dates.length > 0 ? 1 : 0, best: dates.length };
}

// ─── Main hook ────────────────────────────────────────────────────────────────

export function useHabitsToday() {
  const today     = getTodayStr();
  const yesterday = getYesterdayStr();
  const from60    = getDaysAgoStr(59);

  const habitsQuery = useQuery({
    queryKey: HABIT_KEYS.lists(),
    queryFn:  () => HabitService.getHabits(),
    staleTime: 1000 * 60 * 5,
  });

  const completionsQuery = useQuery({
    queryKey: HABIT_KEYS.today(today),
    queryFn:  () => HabitService.getDayCompletions(today),
    staleTime: 0,
  });

  const yesterdayQuery = useQuery({
    queryKey: HABIT_KEYS.today(yesterday),
    queryFn:  () => HabitService.getDayCompletions(yesterday),
    staleTime: 1000 * 60 * 10,
  });

  const habits   = habitsQuery.data ?? [];
  const habitIds = habits.map((h) => h.id);

  const recentQuery = useQuery({
    queryKey: HABIT_KEYS.completionsRange('all', from60, today),
    queryFn:  () => HabitService.getCompletionsForHabits(habitIds, from60, today),
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
        // Only flag at_risk if the habit existed before yesterday (not brand-new)
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
    allHabits:         habits,       // all non-archived habits (right panel + all-habits tab)
    recentCompletions,               // 60-day batch (weekly rhythm + 30d rate)
    completedCount,
    totalCount,
    // Wait for all 4 queries so streaks + at_risk are correct from the start
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
  const from60 = getDaysAgoStr(59);

  return useMutation({
    mutationFn: (input: CompleteHabitInput) => HabitService.completeHabit(input),
    onSuccess: () => {
      // Invalidate today's completions AND the 60-day batch so streaks update
      queryClient.invalidateQueries({ queryKey: HABIT_KEYS.today(today) });
      queryClient.invalidateQueries({ queryKey: HABIT_KEYS.completionsRange('all', from60, today) });
    },
    onError: () => {
      toast.error("Failed to complete habit.");
    },
  });
}

export function useUncompleteHabit() {
  const queryClient = useQueryClient();
  const today  = getTodayStr();
  const from60 = getDaysAgoStr(59);

  return useMutation({
    mutationFn: ({ habitId, date }: { habitId: string; date: string }) =>
      HabitService.uncompleteHabit(habitId, date),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: HABIT_KEYS.today(today) });
      queryClient.invalidateQueries({ queryKey: HABIT_KEYS.completionsRange('all', from60, today) });
    },
    onError: () => {
      toast.error("Failed to undo completion.");
    },
  });
}
