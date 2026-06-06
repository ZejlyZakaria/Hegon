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

// A weekly habit with no specific day = "once per week, any day" — the WEEK is the
// unit (vs. a weekly habit anchored to a day, or `custom` multi-day). Such habits
// are day-agnostic: they show all week and their streak counts in weeks.
export function isWeeklyAnyDay(
  habit: Pick<Habit, "frequency" | "custom_days">,
): boolean {
  return habit.frequency === "weekly" && (habit.custom_days?.length ?? 0) === 0;
}

/** Monday (YYYY-MM-DD) of the week containing `dateStr`. */
export function weekStartStr(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const dow = d.getDay();
  d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
  return toDateStr(d);
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

// ─── Cross-module auto-completion ────────────────────────────────────────────────

/**
 * Maps an activity date (e.g. when a film was watched) to the habit completion
 * date it should satisfy. The streak engine only counts completions on *scheduled*
 * days, so for weekly/custom habits we can't just tick the raw activity day.
 *
 * "Flexible" rule (agreed with owner): any day of the period counts.
 *  - daily            → the activity day itself (always scheduled).
 *  - activity on a scheduled day → that day.
 *  - weekly/custom otherwise → the scheduled day inside the Monday-start week that
 *    contains the activity, nearest to it. So "1 film/week" anchored on Tuesday
 *    ticks Tuesday no matter which day you actually watched that week.
 * Returns null if the habit has no scheduled day in that week.
 */
export function resolveActivityTickDate(
  habit: Pick<Habit, "frequency" | "custom_days">,
  activityDate: string,
): string | null {
  if (habit.frequency === "daily") return activityDate;
  if (isExpectedOnDate(habit, activityDate)) return activityDate;

  const days = habit.custom_days ?? [];
  if (days.length === 0) return activityDate; // weekly w/o a day → treat as any-day

  // Monday-start week containing the activity date.
  const base = new Date(activityDate + "T12:00:00");
  const dow = base.getDay(); // 0=Sun … 6=Sat
  const monday = new Date(base);
  monday.setDate(base.getDate() - (dow === 0 ? 6 : dow - 1));

  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return toDateStr(d);
  });

  const candidates = weekDates.filter((d) =>
    days.includes(new Date(d + "T12:00:00").getDay()),
  );
  if (candidates.length === 0) return null;

  const target = Date.parse(activityDate + "T12:00:00");
  return candidates.reduce((best, d) =>
    Math.abs(Date.parse(d + "T12:00:00") - target) <
    Math.abs(Date.parse(best + "T12:00:00") - target)
      ? d
      : best,
  );
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

/** Hard cap on the streak scan so an ancient `created_at` can't blow up the loop. */
export const MAX_STREAK_WINDOW = 366 * 6; // ~6 years

/**
 * Size the streak scan window to the actual data extent: number of whole days
 * from `earliest` (YYYY-MM-DD) up to today, plus a small buffer, capped. Sizing
 * to the data — not a fixed 90/365 — is what makes streaks honest: the scan must
 * reach as far back as completions exist, no further.
 */
export function streakWindowDays(earliest: string, today: string = getTodayStr()): number {
  const days = Math.floor((Date.parse(today) - Date.parse(earliest)) / 86_400_000);
  return Math.min(Math.max(days, 0) + 2, MAX_STREAK_WINDOW);
}

/**
 * Streak engine for "weekly, any day" habits — the unit is the week. A run counts
 * consecutive weeks (Mon-Sun) with at least one completion. Fully-paused weeks are
 * neutral (bridge), and the current week gets grace while it's still open.
 */
function computeWeeklyStreak(
  completed: Set<string>,
  pauses: PausePeriod[],
  windowDays: number,
): { current: number; best: number } {
  const doneWeeks = new Set([...completed].map(weekStartStr));
  const thisWeek = weekStartStr(getTodayStr());
  const weeks = Math.min(Math.ceil(windowDays / 7) + 1, 600);

  const weekAgo = (n: number) => {
    const d = new Date(thisWeek + "T12:00:00");
    d.setDate(d.getDate() - n * 7);
    return toDateStr(d);
  };
  const neutral = (wk: string) => isWithinAnyPause(wk, pauses);

  let current = 0;
  for (let i = 0; i < weeks; i++) {
    const wk = weekAgo(i);
    if (neutral(wk)) continue;
    if (doneWeeks.has(wk)) { current++; continue; }
    if (i === 0) continue; // current week still open → grace
    break;
  }

  let best = 0;
  let run = 0;
  for (let i = weeks - 1; i >= 0; i--) {
    const wk = weekAgo(i);
    if (neutral(wk)) continue;
    if (doneWeeks.has(wk)) {
      run++;
      if (run > best) best = run;
    } else if (i !== 0) {
      run = 0;
    }
  }

  return { current, best };
}

/**
 * Streak engine for every frequency. A streak counts consecutive *scheduled*
 * days that were completed. Days that are not scheduled, are skipped, or fall
 * inside a pause are neutral — they neither count nor break the run. Today is
 * given grace: if it's scheduled but not yet done, the streak isn't broken.
 * Weekly-any-day habits delegate to the week-based engine above.
 */
export function computeStreak(
  habit: Pick<Habit, "frequency" | "custom_days">,
  completed: Set<string>,
  { skipped, pauses = [], windowDays = 365 }: StreakOptions = {},
): { current: number; best: number } {
  if (completed.size === 0) return { current: 0, best: 0 };
  if (isWeeklyAnyDay(habit)) return computeWeeklyStreak(completed, pauses, windowDays);

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
