import { useQuery } from "@tanstack/react-query";
import * as HabitService from "../service";
import { HABIT_KEYS } from "./query-keys";
import type { Habit, HabitStats, HeatmapDay } from "../types";

// Last 90 days is enough to calculate any reasonable streak
function getLast90Days(): { from: string; to: string } {
  const to  = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 89);
  return {
    from: from.toISOString().slice(0, 10),
    to:   to.toISOString().slice(0, 10),
  };
}

function getLast6Months(): { from: string; to: string } {
  const to   = new Date();
  const from = new Date();
  from.setMonth(from.getMonth() - 6);
  return {
    from: from.toISOString().slice(0, 10),
    to:   to.toISOString().slice(0, 10),
  };
}

// -------------------------------------------------------
// Streak calculation (client-side, daily habits only for V1)
// -------------------------------------------------------

function calcStreak(
  completionDates: string[],  // sorted descending
  habit: Habit
): { current: number; best: number } {
  if (completionDates.length === 0) return { current: 0, best: 0 };

  const dateSet = new Set(completionDates);

  if (habit.frequency === 'daily') {
    const today = new Date();
    let current = 0;
    let best    = 0;
    let run     = 0;

    // Current streak: go back from today (or yesterday if not yet done today)
    const todayStr = today.toISOString().slice(0, 10);
    const startFrom = dateSet.has(todayStr) ? 0 : 1;

    for (let i = startFrom; i < 365; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const ds = d.toISOString().slice(0, 10);
      if (dateSet.has(ds)) {
        current++;
      } else {
        break;
      }
    }

    // Best streak: scan all dates sorted ascending
    const sorted = [...completionDates].reverse();
    for (let i = 0; i < sorted.length; i++) {
      if (i === 0) {
        run = 1;
      } else {
        const prev = new Date(sorted[i - 1]);
        const curr = new Date(sorted[i]);
        prev.setDate(prev.getDate() + 1);
        if (prev.toISOString().slice(0, 10) === curr.toISOString().slice(0, 10)) {
          run++;
        } else {
          run = 1;
        }
      }
      if (run > best) best = run;
    }

    return { current, best };
  }

  // For weekly/custom: simple count of completed occurrences (V1 approximation)
  return { current: completionDates.length > 0 ? 1 : 0, best: completionDates.length };
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

  // Completion rate over last 30 days
  const thirtyAgo = new Date();
  thirtyAgo.setDate(thirtyAgo.getDate() - 29);
  const thirtyAgoStr = thirtyAgo.toISOString().slice(0, 10);
  const last30 = dates.filter((d) => d >= thirtyAgoStr);
  const completion_rate_30d = Math.round((last30.length / 30) * 100);

  const { current, best } = calcStreak(dates, habit);

  return {
    stats: {
      current_streak:      current,
      best_streak:         best,
      completion_rate_30d: Math.min(completion_rate_30d, 100),
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
