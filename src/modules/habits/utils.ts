import type { Habit } from "./types";

// ─── Date helpers ──────────────────────────────────────────────────────────────

export function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function getTodayStr(): string {
  return toDateStr(new Date());
}

export function getYesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return toDateStr(d);
}

export function getDaysAgoStr(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toDateStr(d);
}

// Anchor at T12:00:00 so setDate +1 never crosses a DST boundary
export function addOneDay(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + 1);
  return toDateStr(d);
}

// ─── Frequency helpers ─────────────────────────────────────────────────────────

export function isExpectedOnDate(
  habit: Pick<Habit, "frequency" | "custom_days">,
  date: string,
): boolean {
  if (habit.frequency === "daily") return true;
  const dow = new Date(date + "T12:00:00").getDay();
  return habit.custom_days?.includes(dow) ?? false;
}

// ─── Streak calculations ───────────────────────────────────────────────────────

type Completion = { habit_id: string; completed_date: string };

// Used in useHabitsToday — receives the 90-day batch for all habits
export function calcStreaks(
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

  if (habit.frequency === "daily") {
    const today = getTodayStr();
    const start = dateSet.has(today) ? 0 : 1;
    let current = 0;
    for (let i = start; i < 90; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      if (dateSet.has(toDateStr(d))) current++;
      else break;
    }

    let best = 0;
    let run = 0;
    for (let i = 0; i < dates.length; i++) {
      if (i === 0) {
        run = 1;
      } else {
        run = addOneDay(dates[i - 1]) === dates[i] ? run + 1 : 1;
      }
      if (run > best) best = run;
    }

    return { current, best };
  }

  // weekly / custom: simple count for V1
  return { current: dates.length > 0 ? 1 : 0, best: dates.length };
}

// Used in useHabitStats — receives dates sorted descending for a single habit
export function calcStreak(
  completionDates: string[],
  habit: Habit,
): { current: number; best: number } {
  if (completionDates.length === 0) return { current: 0, best: 0 };

  const dateSet = new Set(completionDates);

  if (habit.frequency === "daily") {
    const today = new Date();
    const todayStr = toDateStr(today);
    const startFrom = dateSet.has(todayStr) ? 0 : 1;

    let current = 0;
    for (let i = startFrom; i < 365; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      if (dateSet.has(toDateStr(d))) current++;
      else break;
    }

    // best streak: scan ascending
    const sorted = [...completionDates].reverse();
    let best = 0;
    let run = 0;
    for (let i = 0; i < sorted.length; i++) {
      if (i === 0) {
        run = 1;
      } else {
        run = addOneDay(sorted[i - 1]) === sorted[i] ? run + 1 : 1;
      }
      if (run > best) best = run;
    }

    return { current, best };
  }

  return { current: completionDates.length > 0 ? 1 : 0, best: completionDates.length };
}
