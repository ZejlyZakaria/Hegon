import { computeStreak, isExpectedOnDate, toDateStr } from "./utils";
import type { Habit } from "./types";
import type { Achievement, AchievementIcon } from "@/shared/components/achievements/types";

// Elemental colors for the streak tiers — the rest fall back to the module accent.
const FIRE = "var(--color-fire)";
const SILVER = "#cbd5e1";
const GOLD = "var(--color-gold)";
const ICE = "var(--color-ice)";

interface Ctx {
  habits: Habit[];
  recentCompletions: { habit_id: string; completed_date: string }[];
  today: string;
}

function shiftDate(dateStr: string, deltaDays: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + deltaDays);
  return toDateStr(d);
}

function gapDays(a: string, b: string): number {
  const da = new Date(a + "T12:00:00").getTime();
  const db = new Date(b + "T12:00:00").getTime();
  return Math.round((db - da) / 86_400_000);
}

function tier(
  key: string,
  name: string,
  description: string,
  icon: AchievementIcon,
  maxBest: number,
  threshold: number,
  color: string,
): Achievement {
  return {
    key,
    name,
    description,
    icon,
    color,
    unlocked: maxBest >= threshold,
    progress: Math.min(maxBest / threshold, 1),
    progressLabel: `${Math.min(maxBest, threshold)} / ${threshold} days`,
  };
}

export function computeAchievements({ habits, recentCompletions, today }: Ctx): Achievement[] {
  // Best streak across every habit (within the available completion window).
  let maxBest = 0;
  for (const h of habits) {
    const set = new Set(
      recentCompletions.filter((c) => c.habit_id === h.id).map((c) => c.completed_date),
    );
    const { best } = computeStreak(h, set);
    if (best > maxBest) maxBest = best;
  }

  // Per-day "perfect" map over the last 90 days (every scheduled habit done).
  const compSet = new Set(recentCompletions.map((c) => `${c.habit_id}|${c.completed_date}`));
  const days: { date: string; perfect: boolean; scheduled: number }[] = [];
  for (let i = 89; i >= 0; i--) {
    const d = shiftDate(today, -i);
    const scheduled = habits.filter(
      (h) => h.created_at.slice(0, 10) <= d && isExpectedOnDate(h, d),
    );
    const perfect = scheduled.length > 0 && scheduled.every((h) => compSet.has(`${h.id}|${d}`));
    days.push({ date: d, perfect, scheduled: scheduled.length });
  }

  // Perfect Week — longest run of consecutive perfect days.
  let bestPerfectRun = 0;
  let run = 0;
  for (const day of days) {
    if (day.perfect) {
      run++;
      if (run > bestPerfectRun) bestPerfectRun = run;
    } else {
      run = 0;
    }
  }

  // Perfect Month — a fully-elapsed calendar month (within window) with every
  // scheduled day perfect.
  const byMonth = new Map<string, typeof days>();
  for (const day of days) {
    const mk = day.date.slice(0, 7);
    const arr = byMonth.get(mk) ?? [];
    arr.push(day);
    byMonth.set(mk, arr);
  }
  const currentMonthKey = today.slice(0, 7);
  let perfectMonth = false;
  for (const [mk, arr] of byMonth) {
    if (mk >= currentMonthKey) continue;
    const [y, m] = mk.split("-").map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    if (arr.length < daysInMonth) continue; // not fully covered by window
    const scheduledDays = arr.filter((d) => d.scheduled > 0);
    if (scheduledDays.length > 0 && scheduledDays.every((d) => d.perfect)) {
      perfectMonth = true;
      break;
    }
  }

  // Comeback — completed a habit again after a 14+ day absence.
  let comeback = false;
  for (const h of habits) {
    const dates = recentCompletions
      .filter((c) => c.habit_id === h.id)
      .map((c) => c.completed_date)
      .sort();
    for (let i = 1; i < dates.length; i++) {
      if (gapDays(dates[i - 1], dates[i]) >= 15) {
        comeback = true;
        break;
      }
    }
    if (comeback) break;
  }

  const activeCount = habits.length;

  return [
    tier("streak-7", "Week Warrior", "Reach a 7-day streak", "flame", maxBest, 7, FIRE),
    tier("streak-30", "Month Master", "Reach a 30-day streak", "medal", maxBest, 30, SILVER),
    tier("streak-100", "Centurion", "Reach a 100-day streak", "trophy", maxBest, 100, GOLD),
    tier("streak-365", "Legend", "Reach a 365-day streak", "gem", maxBest, 365, ICE),
    {
      key: "perfect-week",
      name: "Perfect Week",
      description: "7 days, every habit done",
      icon: "calendarCheck",
      unlocked: bestPerfectRun >= 7,
      progress: Math.min(bestPerfectRun / 7, 1),
      progressLabel: `${Math.min(bestPerfectRun, 7)} / 7 days`,
    },
    {
      key: "perfect-month",
      name: "Perfect Month",
      description: "A full month at 100%",
      icon: "calendarRange",
      unlocked: perfectMonth,
      progress: perfectMonth ? 1 : 0,
      progressLabel: perfectMonth ? "Unlocked" : "Locked",
    },
    {
      key: "collector",
      name: "Habit Collector",
      description: "Keep 5 habits active",
      icon: "layers",
      unlocked: activeCount >= 5,
      progress: Math.min(activeCount / 5, 1),
      progressLabel: `${Math.min(activeCount, 5)} / 5 habits`,
    },
    {
      key: "comeback",
      name: "Comeback",
      description: "Return after a 14-day break",
      icon: "rotateCcw",
      unlocked: comeback,
      progress: comeback ? 1 : 0,
      progressLabel: comeback ? "Unlocked" : "Locked",
    },
  ];
}
