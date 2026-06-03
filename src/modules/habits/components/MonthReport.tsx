"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Award,
  CalendarDays,
  Flame,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useHabits } from "../hooks/useHabits";
import { useGoals } from "@/modules/goals/hooks/useGoals";
import { HABIT_KEYS } from "../hooks/query-keys";
import * as HabitService from "../service";
import { resolveIcon } from "@/shared/constants/icons";
import { cn } from "@/shared/utils/utils";
import { isExpectedOnDate, heatmapColor } from "../utils";
import type { HeatmapDay } from "../types";

const ACCENT = "var(--color-accent-habits-vivid)";
const FIRE = "var(--color-fire)";
const GOLD = "var(--color-gold)";
const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function cellColor(count: number): string {
  return heatmapColor(count);
}

interface Props {
  month: string; // "YYYY-MM"
}

export function MonthReport({ month }: Props) {
  const [yStr, mStr] = month.split("-");
  const year = Number(yStr);
  const monthIdx = Number(mStr) - 1;
  const valid = year >= 2000 && monthIdx >= 0 && monthIdx <= 11;

  const now = new Date();
  const lastDay = valid ? new Date(year, monthIdx + 1, 0).getDate() : 30;
  const monthStart = `${year}-${pad(monthIdx + 1)}-01`;
  const monthEnd = `${year}-${pad(monthIdx + 1)}-${pad(lastDay)}`;
  const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const isCurrentMonth = year === now.getFullYear() && monthIdx === now.getMonth();
  const rateEnd = isCurrentMonth ? todayStr : monthEnd;

  // previous month range
  const prevDate = new Date(year, monthIdx - 1, 1);
  const prevStart = `${prevDate.getFullYear()}-${pad(prevDate.getMonth() + 1)}-01`;
  const prevEnd = `${prevDate.getFullYear()}-${pad(prevDate.getMonth() + 1)}-${pad(
    new Date(prevDate.getFullYear(), prevDate.getMonth() + 1, 0).getDate(),
  )}`;

  const { data: habits = [] } = useHabits();
  const { data: goals = [] } = useGoals();
  const habitIds = habits.map((h) => h.id);

  const { data: comps = [] } = useQuery({
    queryKey: HABIT_KEYS.completionsRange("report", monthStart, monthEnd),
    queryFn: () => HabitService.getCompletionsForHabits(habitIds, monthStart, monthEnd),
    enabled: valid && habitIds.length > 0,
    staleTime: 1000 * 60 * 5,
  });

  const { data: prevData = [] } = useQuery<HeatmapDay[]>({
    queryKey: HABIT_KEYS.heatmap(prevStart, prevEnd),
    queryFn: () => HabitService.getHeatmapData(prevStart, prevEnd),
    enabled: valid,
    staleTime: 1000 * 60 * 10,
  });

  if (!valid) {
    return (
      <div className="px-6 py-10 text-center text-sm text-text-tertiary">
        Invalid month.{" "}
        <Link href="/life/habits" className="underline">
          Back to Habits
        </Link>
      </div>
    );
  }

  // ── Aggregations ──────────────────────────────────────────────────────────
  const dayTotals = new Map<string, number>();
  const perHabit = new Map<string, number>();
  for (const c of comps) {
    dayTotals.set(c.completed_date, (dayTotals.get(c.completed_date) ?? 0) + 1);
    perHabit.set(c.habit_id, (perHabit.get(c.habit_id) ?? 0) + 1);
  }

  const totalCompletions = comps.length;
  const activeDays = dayTotals.size;
  const prevTotal = prevData.reduce((s, d) => s + d.count, 0);
  const delta = totalCompletions - prevTotal;
  const deltaPct = prevTotal > 0 ? Math.round((delta / prevTotal) * 100) : null;

  // best day + longest active-day streak (consecutive days with >=1 completion)
  let bestDay: { date: string; count: number } | null = null;
  let longestRun = 0;
  let run = 0;
  for (let d = 1; d <= lastDay; d++) {
    const ds = `${year}-${pad(monthIdx + 1)}-${pad(d)}`;
    if (ds > rateEnd) break;
    const cnt = dayTotals.get(ds) ?? 0;
    if (!bestDay || cnt > bestDay.count) bestDay = { date: ds, count: cnt };
    if (cnt > 0) {
      run++;
      if (run > longestRun) longestRun = run;
    } else {
      run = 0;
    }
  }

  // per-habit rate within the month
  const habitRows = habits
    .map((h) => {
      const createdDate = h.created_at.slice(0, 10);
      let expected = 0;
      for (let d = 1; d <= lastDay; d++) {
        const ds = `${year}-${pad(monthIdx + 1)}-${pad(d)}`;
        if (ds > rateEnd) break;
        if (ds >= createdDate && isExpectedOnDate(h, ds)) expected++;
      }
      const done = perHabit.get(h.id) ?? 0;
      const rate = expected > 0 ? Math.min(Math.round((done / expected) * 100), 100) : null;
      return { habit: h, done, expected, rate };
    })
    .filter((r) => r.expected > 0 || r.done > 0)
    .sort((a, b) => (b.rate ?? -1) - (a.rate ?? -1) || b.done - a.done);

  const champion = habitRows.find((r) => r.rate !== null && r.done > 0) ?? null;

  const totalExpected = habitRows.reduce((s, r) => s + r.expected, 0);
  const overallRate = totalExpected > 0 ? Math.min(Math.round((totalCompletions / totalExpected) * 100), 100) : 0;

  // linked goals
  const linkedGoalIds = Array.from(
    new Set(habits.filter((h) => h.goal_id).map((h) => h.goal_id as string)),
  );
  const linkedGoals = linkedGoalIds
    .map((id) => {
      const goal = goals.find((g) => g.id === id);
      if (!goal) return null;
      const feeders = habits.filter((h) => h.goal_id === id);
      const monthContribution = feeders.reduce((s, h) => s + (perHabit.get(h.id) ?? 0), 0);
      return { goal, feeders: feeders.length, monthContribution };
    })
    .filter((g): g is NonNullable<typeof g> => g !== null && g.monthContribution > 0);

  // month calendar grid (Monday aligned)
  const firstDow = new Date(year, monthIdx, 1).getDay();
  const offset = (firstDow + 6) % 7;
  const calCells: ({ date: string; count: number; future: boolean } | null)[] = Array.from(
    { length: offset },
    () => null,
  );
  for (let d = 1; d <= lastDay; d++) {
    const ds = `${year}-${pad(monthIdx + 1)}-${pad(d)}`;
    calCells.push({ date: ds, count: dayTotals.get(ds) ?? 0, future: ds > todayStr });
  }

  const monthName = MONTHS_LONG[monthIdx];
  const prevMonthName = MONTHS_LONG[prevDate.getMonth()];
  const empty = totalCompletions === 0;

  return (
    <div className="mx-auto max-w-5xl px-6 py-6">
      {/* Back */}
      <Link
        href="/life/habits"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-text-tertiary transition-colors hover:text-text-primary"
      >
        <ArrowLeft size={14} />
        Habits
      </Link>

      {/* Hero */}
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-text-primary">
            {monthName}{" "}
            <span className="font-light text-text-tertiary">{year}</span>
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            {empty
              ? "No completions logged this month."
              : `${totalCompletions} completions · ${overallRate}% completion rate`}
          </p>
        </div>
        {deltaPct !== null && !empty && (
          <div
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium",
              delta >= 0 ? "text-emerald-400" : "text-amber-400",
            )}
            style={{ backgroundColor: delta >= 0 ? "rgba(16,185,129,0.1)" : "rgba(245,158,11,0.1)" }}
          >
            {delta >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
            {delta >= 0 ? "+" : ""}{deltaPct}% vs {prevMonthName}
          </div>
        )}
      </div>

      {/* Stat tiles */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile icon={<CalendarDays size={15} />} label="Completions" value={`${totalCompletions}`} accent />
        <StatTile label="Completion rate" value={`${overallRate}%`} />
        <StatTile label="Active days" value={`${activeDays}`} />
        <StatTile icon={<Flame size={15} />} label="Longest streak" value={`${longestRun}d`} color={FIRE} />
      </div>

      {/* Calendar + Champion */}
      <div className="mt-6 grid grid-cols-1 gap-3 lg:grid-cols-[1fr_320px]">
        {/* Calendar */}
        <div className="rounded-xl border border-border-subtle bg-surface-1 p-5">
          <p className="mb-3 text-caption uppercase text-text-tertiary">
            {monthName} at a glance
          </p>
          <div className="mb-1.5 grid grid-cols-7 gap-1">
            {DOW.map((d) => (
              <div key={d} className="text-center text-[10px] font-medium text-text-tertiary">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {calCells.map((c, i) =>
              c === null ? (
                <div key={i} className="aspect-square" />
              ) : (
                <div
                  key={i}
                  className={cn(
                    "flex aspect-square items-center justify-center rounded-md text-[10px] font-medium",
                    c.date === todayStr && "ring-1 ring-border-strong",
                  )}
                  style={{
                    backgroundColor: c.future ? "transparent" : cellColor(c.count),
                    color: c.count > 2 ? "#fff" : "var(--color-text-tertiary)",
                  }}
                  title={c.future ? undefined : `${c.date} · ${c.count} completion${c.count !== 1 ? "s" : ""}`}
                >
                  {new Date(c.date + "T12:00:00").getDate()}
                </div>
              ),
            )}
          </div>
          {bestDay && bestDay.count > 0 && (
            <p className="mt-3 text-[11px] text-text-tertiary">
              Best day:{" "}
              <span className="font-medium text-text-secondary">
                {new Date(bestDay.date + "T12:00:00").toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "short",
                  day: "numeric",
                })}
              </span>{" "}
              ({bestDay.count} completions)
            </p>
          )}
        </div>

        {/* Champion */}
        <div className="rounded-xl border border-border-subtle bg-surface-1 p-5">
          <p className="mb-3 text-caption uppercase text-text-tertiary">
            Standout habit
          </p>
          {champion ? (
            (() => {
              const { icon: Icon, color } = resolveIcon(champion.habit.icon);
              return (
                <div>
                  <div className="flex items-center gap-3">
                    <div
                      className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border-subtle bg-surface-2"
                      style={{ color }}
                    >
                      <Icon size={22} />
                      <span
                        className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full"
                        style={{ backgroundColor: GOLD }}
                      >
                        <Award size={11} className="text-black/70" />
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-text-primary">
                        {champion.habit.title}
                      </p>
                      <p className="text-xs text-text-tertiary">
                        {champion.done}/{champion.expected} days
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-baseline gap-1.5">
                    <span className="text-3xl font-bold tabular-nums" style={{ color: ACCENT }}>
                      {champion.rate}%
                    </span>
                    <span className="text-xs text-text-tertiary">completion this month</span>
                  </div>
                </div>
              );
            })()
          ) : (
            <p className="text-sm text-text-tertiary">No habit data this month.</p>
          )}
        </div>
      </div>

      {/* Habits breakdown */}
      {habitRows.length > 0 && (
        <div className="mt-6 rounded-xl border border-border-subtle bg-surface-1 p-5">
          <p className="mb-4 text-caption uppercase text-text-tertiary">
            Every habit this month
          </p>
          <div className="space-y-3">
            {habitRows.map((r) => {
              const { icon: Icon, color } = resolveIcon(r.habit.icon);
              const isChamp = champion?.habit.id === r.habit.id;
              return (
                <div key={r.habit.id} className="flex items-center gap-3">
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border-subtle bg-surface-2"
                    style={{ color }}
                  >
                    <Icon size={15} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 truncate text-sm font-medium text-text-primary">
                        {r.habit.title}
                        {isChamp && <Award size={12} style={{ color: GOLD }} className="shrink-0" />}
                      </span>
                      <span className="shrink-0 text-xs text-text-tertiary">
                        {r.done}/{r.expected}
                        {r.rate !== null && (
                          <span className="ml-1.5 font-semibold text-text-secondary">{r.rate}%</span>
                        )}
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                      <div
                        className="h-full rounded-full transition-[width] duration-500"
                        style={{ width: `${r.rate ?? 0}%`, backgroundColor: ACCENT }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Goals fueled */}
      {linkedGoals.length > 0 && (
        <div className="mt-6 rounded-xl border border-border-subtle bg-surface-1 p-5">
          <p className="mb-4 text-caption uppercase text-text-tertiary">
            Goals you fueled
          </p>
          <div className="space-y-3">
            {linkedGoals.map(({ goal, feeders, monthContribution }) => (
              <Link
                key={goal.id}
                href={`/life/goals/${goal.id}`}
                className="flex items-center gap-3 rounded-lg border border-border-subtle bg-surface-1 p-3 transition-colors hover:bg-surface-2"
              >
                <Target size={16} className="shrink-0" style={{ color: "var(--color-accent-goals)" }} />
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-text-primary">{goal.title}</span>
                    <span className="shrink-0 text-xs font-semibold" style={{ color: "var(--color-accent-goals)" }}>
                      {goal.progress}%
                    </span>
                  </div>
                  <p className="text-[11px] text-text-tertiary">
                    {monthContribution} completions from {feeders} habit{feeders !== 1 ? "s" : ""} this month
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatTile({
  icon,
  label,
  value,
  accent,
  color,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  accent?: boolean;
  color?: string;
}) {
  const tint = color ?? (accent ? ACCENT : undefined);
  return (
    <div className="rounded-xl border border-border-subtle bg-surface-1 px-4 py-3.5">
      <div className="flex items-center gap-1.5 text-[11px] text-text-tertiary">
        {icon && <span style={tint ? { color: tint } : undefined}>{icon}</span>}
        {label}
      </div>
      <p
        className="mt-1.5 text-2xl font-bold tabular-nums"
        style={{ color: tint ?? "var(--color-text-primary)" }}
      >
        {value}
      </p>
    </div>
  );
}
