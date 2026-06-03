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

// Heatmap intensity ramp, derived from the module accent so it always follows
// the CSS variable (change the accent → the heatmap follows automatically).
export function heatmapColor(count: number): string {
  if (count <= 0) return "var(--color-surface-2)";
  const pct = count === 1 ? 28 : count === 2 ? 48 : count <= 4 ? 72 : 100;
  if (pct === 100) return "var(--color-accent-habits-vivid)";
  return `color-mix(in srgb, var(--color-accent-habits-vivid) ${pct}%, var(--color-surface-2))`;
}

// 0=Sun … 6=Sat. Display order is Monday-first.
const DOW_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DOW_DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

// Human label for the Today table's Frequency column.
// daily → "Daily"; full week → "Daily"; otherwise the day names ("Mon/Wed/Fri").
export function formatFrequency(
  habit: Pick<Habit, "frequency" | "custom_days">,
): string {
  if (habit.frequency === "daily") return "Daily";
  const days = habit.custom_days ?? [];
  if (days.length === 0) return habit.frequency === "weekly" ? "Weekly" : "Custom";
  if (days.length === 7) return "Daily";
  return DOW_DISPLAY_ORDER.filter((d) => days.includes(d))
    .map((d) => DOW_SHORT[d])
    .join("/");
}

// ─── Streak calculations ───────────────────────────────────────────────────────

type Completion = { habit_id: string; completed_date: string };
export type PausePeriod = { start: string; end: string | null };

export interface StreakOptions {
  skipped?: Set<string>;     // skip dates → neutral (preserve streak)
  pauses?: PausePeriod[];    // paused ranges → neutral, streak bridges across
  windowDays?: number;       // how far back to scan (default 365)
}

export function isWithinAnyPause(date: string, pauses: PausePeriod[]): boolean {
  return pauses.some(
    (p) => date >= p.start && (p.end === null || date <= p.end),
  );
}

/**
 * Streak engine for every frequency. A streak counts consecutive *scheduled*
 * days that were completed. Days that are not scheduled, are skipped, or fall
 * inside a pause are neutral — they neither count nor break the run. Today is
 * given grace: if it's scheduled but not yet done, the streak isn't broken.
 */
export function computeStreak(
  habit: Pick<Habit, "frequency" | "custom_days">,
  completed: Set<string>,
  { skipped, pauses = [], windowDays = 365 }: StreakOptions = {},
): { current: number; best: number } {
  if (completed.size === 0) return { current: 0, best: 0 };

  const skips = skipped ?? new Set<string>();
  const isNeutral = (d: string) =>
    isWithinAnyPause(d, pauses) || skips.has(d) || !isExpectedOnDate(habit, d);

  // Current — walk backward from today.
  let current = 0;
  for (let i = 0; i < windowDays; i++) {
    const d = getDaysAgoStr(i);
    if (isNeutral(d)) continue;
    if (completed.has(d)) {
      current++;
      continue;
    }
    if (i === 0) continue; // today scheduled but pending → grace, don't break
    break;
  }

  // Best — walk forward across the window.
  let best = 0;
  let run = 0;
  for (let i = windowDays - 1; i >= 0; i--) {
    const d = getDaysAgoStr(i);
    if (isNeutral(d)) continue;
    if (completed.has(d)) {
      run++;
      if (run > best) best = run;
    } else if (i !== 0) {
      run = 0; // a missed scheduled day breaks the run (today's pending excepted)
    }
  }

  return { current, best };
}

// Used in useHabitsToday — receives the batch of completions for all habits.
export function calcStreaks(
  habitId: string,
  completions: Completion[],
  habit: Habit,
  options?: StreakOptions,
): { current: number; best: number } {
  const completed = new Set(
    completions
      .filter((c) => c.habit_id === habitId)
      .map((c) => c.completed_date),
  );
  return computeStreak(habit, completed, options);
}

// Used in useHabitStats — receives a single habit's completion dates.
export function calcStreak(
  completionDates: string[],
  habit: Habit,
  options?: StreakOptions,
): { current: number; best: number } {
  return computeStreak(habit, new Set(completionDates), options);
}
