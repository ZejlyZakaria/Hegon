import { useQuery } from "@tanstack/react-query";
import * as HabitService from "../service";
import { HABIT_KEYS } from "./query-keys";
import {
  toDateStr,
  getDaysAgoStr,
  isExpectedOnDate,
  calcStreak,
} from "../utils";
import type { Habit, HabitStats, HeatmapDay } from "../types";

function getLast90Days(): { from: string; to: string } {
  return { from: getDaysAgoStr(89), to: toDateStr(new Date()) };
}

function getLast6Months(): { from: string; to: string } {
  const to   = new Date();
  const from = new Date();
  from.setMonth(from.getMonth() - 6);
  return { from: toDateStr(from), to: toDateStr(to) };
}

// -------------------------------------------------------
// Hook
// -------------------------------------------------------

export function useHabitStats(habit: Habit): {
  stats: HabitStats | null;
  isLoading: boolean;
} {
  const { from, to } = getLast90Days();

  const { data: completions, isLoading } = useQuery({
    queryKey: HABIT_KEYS.completionsRange(habit.id, from, to),
    queryFn:  () => HabitService.getHabitCompletionsRange(habit.id, from, to),
    staleTime: 1000 * 60 * 5,
  });

  if (!completions) return { stats: null, isLoading };

  const dates = completions.map((c) => c.completed_date);

  // Completion rate over last 30 days — denominator accounts for habit frequency
  const thirtyAgoStr = getDaysAgoStr(29);
  const last30 = dates.filter((d) => d >= thirtyAgoStr);

  let expectedDays = 30;
  if (habit.frequency !== "daily") {
    expectedDays = 0;
    const start = new Date();
    start.setDate(start.getDate() - 29);
    for (let i = 0; i < 30; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      if (isExpectedOnDate(habit, toDateStr(d))) expectedDays++;
    }
  }

  const completion_rate_30d = expectedDays > 0
    ? Math.min(Math.round((last30.length / expectedDays) * 100), 100)
    : 0;

  const { current, best } = calcStreak(dates, habit);

  return {
    stats: {
      current_streak:      current,
      best_streak:         best,
      completion_rate_30d,
      total_completions:   completions.length,
    },
    isLoading,
  };
}

// -------------------------------------------------------
// Heatmap hook (All Habits tab)
// -------------------------------------------------------

export function useHeatmapData(): {
  data: HeatmapDay[];
  isLoading: boolean;
} {
  const { from, to } = getLast6Months();

  const { data, isLoading } = useQuery({
    queryKey: HABIT_KEYS.heatmap(from, to),
    queryFn:  () => HabitService.getHeatmapData(from, to),
    staleTime: 1000 * 60 * 10,
  });

  return { data: data ?? [], isLoading };
}
