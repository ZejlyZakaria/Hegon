"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Flame,
  Trophy,
  Sparkles,
  Gauge,
  Target,
  CalendarDays,
  CalendarRange,
  BarChart2,
  ChevronRight,
} from "lucide-react";
import { resolveIcon } from "@/shared/constants/icons";
import { cn } from "@/shared/utils/utils";
import { MetricCard } from "@/shared/components/stats/MetricCard";
import { useHabitsToday } from "../hooks/useHabitsToday";
import { useHabitsUIStore } from "../store";
import { HABIT_KEYS } from "../hooks/query-keys";
import * as HabitService from "../service";
import { getDaysAgoStr, isExpectedOnDate, isWithinAnyPause, type PausePeriod } from "../utils";
import type { HabitWithStatus, HeatmapDay } from "../types";
import { AllHabitsHeatmap } from "./AllHabitsHeatmap";
import { HabitsAchievements } from "./HabitsAchievements";
import { StatsSkeleton } from "./HabitsSkeleton";

const ACCENT = "var(--color-accent-habits-vivid)";
const FIRE = "var(--color-fire)";
const GOLD = "var(--color-gold)";

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function scoreLabel(s: number): string {
  if (s >= 80) return "Exceptional";
  if (s >= 60) return "Strong";
  if (s >= 35) return "Building";
  return "Getting started";
}

// Scheduled-vs-done over a window of `len` days starting `offset` days ago,
// frequency-aware. Days before the habit existed, or inside a pause period, are
// neutral — they don't count toward expected (pausing must not punish the score).
// Returns raw counts so consistency is POOLED (Σdone / Σexpected), not a mean of
// ratios — pooling kills small-denominator inflation (a 2/2 habit ≠ a 100% vote).
function windowStats(
  habit: HabitWithStatus,
  done: Set<string>,
  pauses: PausePeriod[],
  offset: number,
  len: number,
): { done: number; expected: number } {
  const created = habit.created_at.slice(0, 10);
  let expected = 0;
  let hit = 0;
  for (let i = offset; i < offset + len; i++) {
    const d = getDaysAgoStr(i);
    if (d < created) continue;
    if (!isExpectedOnDate(habit, d)) continue;
    if (isWithinAnyPause(d, pauses)) continue;
    expected++;
    if (done.has(d)) hit++;
  }
  return { done: hit, expected };
}

// ─── Chart card shell ─────────────────────────────────────────────────────────

function ChartCard({
  icon,
  title,
  meta,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  meta?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-60 flex-col overflow-hidden rounded-card surface-card p-5">
      <div className="mb-3 flex shrink-0 items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-text-tertiary">{icon}</span>
          <p className="text-sm font-semibold text-text-primary">{title}</p>
        </div>
        {meta && <span className="text-[11px] text-text-tertiary">{meta}</span>}
      </div>
      {children}
    </div>
  );
}

// ─── Monthly rhythm (12 bars, click → month report) ───────────────────────────

function MonthlyChart({
  year,
  monthTotals,
  bestMonth,
  maxMonthTotal,
  currentMonth,
}: {
  year: number;
  monthTotals: number[];
  bestMonth: number;
  maxMonthTotal: number;
  currentMonth: number;
}) {
  const router = useRouter();

  return (
    <ChartCard icon={<CalendarDays size={14} />} title="Monthly rhythm" meta={String(year)}>
      <div className="flex min-h-0 flex-1 items-stretch gap-1.5">
        {monthTotals.map((total, m) => {
          const isFuture = m > currentMonth;
          const isBest = m === bestMonth && total > 0;
          const hasData = total > 0;
          const heightPct = hasData ? Math.max((total / maxMonthTotal) * 100, 8) : 0;

          return (
            <button
              key={m}
              type="button"
              disabled={isFuture}
              onClick={() => router.push(`/life/habits/${year}-${pad(m + 1)}`)}
              className={cn("group relative flex flex-1 flex-col", isFuture ? "cursor-default" : "cursor-pointer")}
            >
              <div
                className="relative flex w-full flex-1 items-end overflow-hidden rounded-chip"
                style={{ backgroundColor: `color-mix(in srgb, var(--color-surface-2) ${isFuture ? 28 : 55}%, transparent)` }}
              >
                {hasData && (
                  <div
                    className="w-full rounded-chip transition-[height] duration-500 ease-out group-hover:brightness-110"
                    style={{
                      height: `${heightPct}%`,
                      backgroundColor: isBest
                        ? ACCENT
                        : `color-mix(in srgb, ${ACCENT} ${48 + Math.round((total / maxMonthTotal) * 42)}%, var(--color-surface-2))`,
                    }}
                  />
                )}
                {hasData && (
                  <span className="absolute inset-x-0 top-1 text-center text-[10px] font-semibold tabular-nums text-text-primary opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                    {total}
                  </span>
                )}
              </div>
              <span
                className={cn(
                  "mt-2 text-center text-[10px] font-medium tabular-nums",
                  isBest ? "" : "text-text-tertiary",
                  !isFuture && !isBest && "group-hover:text-text-secondary",
                )}
                style={isBest ? { color: ACCENT } : undefined}
              >
                {MONTHS_SHORT[m]}
              </span>
            </button>
          );
        })}
      </div>
    </ChartCard>
  );
}

// ─── Weekly pattern (completions per weekday) ─────────────────────────────────

function WeekdayChart({ data }: { data: number[] }) {
  const max = Math.max(...data, 1);
  const total = data.reduce((s, n) => s + n, 0);
  const bestIdx = data.reduce((b, n, i) => (n > data[b] ? i : b), 0);

  return (
    <ChartCard
      icon={<CalendarRange size={14} />}
      title="Weekly pattern"
      meta={total > 0 ? WEEKDAYS_SHORT[bestIdx] : undefined}
    >
      {total === 0 ? (
        <p className="text-sm text-text-tertiary/50">No completions yet</p>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex flex-1 items-end gap-2">
            {data.map((n, i) => {
              const isBest = i === bestIdx && n > 0;
              return (
                <div key={i} className="group flex flex-1 flex-col items-center justify-end">
                  <span className="mb-1 text-[10px] tabular-nums text-text-tertiary opacity-0 transition-opacity group-hover:opacity-100">
                    {n}
                  </span>
                  <div
                    className="w-full rounded-chip transition-[height] duration-500"
                    style={{
                      height: n > 0 ? `${Math.max((n / max) * 100, 6)}%` : 2,
                      backgroundColor: isBest ? ACCENT : `color-mix(in srgb, ${ACCENT} 45%, var(--color-surface-2))`,
                      opacity: n > 0 ? 1 : 0.4,
                    }}
                  />
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex gap-2">
            {WEEKDAYS_SHORT.map((d, i) => (
              <span
                key={d}
                className="flex-1 text-center text-[10px] font-medium tabular-nums"
                style={i === bestIdx ? { color: ACCENT } : { color: "var(--color-text-tertiary)" }}
              >
                {d[0]}
              </span>
            ))}
          </div>
        </div>
      )}
    </ChartCard>
  );
}

// ─── Top habits (horizontal bars by 30-day rate) ──────────────────────────────

function TopHabitsChart({
  rows,
  onOpen,
}: {
  rows: { habit: HabitWithStatus; rate: number | null }[];
  onOpen: (id: string) => void;
}) {
  const setActiveTab = useHabitsUIStore((s) => s.setActiveTab);

  return (
    <ChartCard icon={<BarChart2 size={14} />} title="Top Habits" meta="by streak">
      {rows.length === 0 ? (
        <p className="text-sm text-text-tertiary/50">No active habits</p>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col justify-center gap-2.5 overflow-hidden">
          {rows.map(({ habit, rate }) => {
            const { icon: Icon, color } = resolveIcon(habit.icon);
            return (
              <button
                key={habit.id}
                type="button"
                onClick={() => onOpen(habit.id)}
                className="group flex items-center gap-2.5 text-left"
              >
                <div
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-tile"
                  style={{ backgroundColor: `color-mix(in srgb, ${color} 16%, transparent)`, color }}
                >
                  <Icon size={12} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="truncate text-xs font-medium text-text-primary">{habit.title}</span>
                    <span className="inline-flex shrink-0 items-center gap-1 text-[11px] tabular-nums text-text-tertiary">
                      <Flame size={11} style={{ color: habit.current_streak > 0 ? FIRE : "var(--color-text-tertiary)" }} />
                      {habit.current_streak}
                    </span>
                  </div>
                  <div className="h-1 w-full overflow-hidden rounded-full bg-surface-2">
                    <div className="h-full rounded-full" style={{ width: `${(rate ?? 0) * 100}%`, backgroundColor: ACCENT }} />
                  </div>
                </div>
                <ChevronRight size={13} className="shrink-0 text-text-tertiary opacity-0 transition-opacity group-hover:opacity-100" />
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className="mt-0.5 self-start text-[11px] font-medium text-text-tertiary transition-colors hover:text-text-primary"
          >
            View all
          </button>
        </div>
      )}
    </ChartCard>
  );
}

// ─── Orchestrator ─────────────────────────────────────────────────────────────

export function HabitsStats() {
  const { allStatus = [], pausesByHabit, recentCompletions, isLoading } = useHabitsToday();
  const openPanel = useHabitsUIStore((s) => s.openPanel);

  const now = new Date();
  const year = now.getFullYear();
  const currentMonth = now.getMonth();
  const todayStr = `${year}-${pad(currentMonth + 1)}-${pad(now.getDate())}`;
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;

  const habitIds = allStatus.map((h) => h.id);

  const { data: yearData = [], isLoading: yearLoading } = useQuery<HeatmapDay[]>({
    queryKey: HABIT_KEYS.heatmap(yearStart, yearEnd),
    queryFn: () => HabitService.getHeatmapData(yearStart, yearEnd),
    staleTime: 1000 * 60 * 10,
  });

  const { data: yearComps = [] } = useQuery({
    queryKey: HABIT_KEYS.completionsRange("year", yearStart, yearEnd),
    queryFn: () => HabitService.getCompletionsForHabits(habitIds, yearStart, yearEnd),
    enabled: habitIds.length > 0,
    staleTime: 1000 * 60 * 10,
  });

  if (isLoading || yearLoading) return <StatsSkeleton />;

  const pauses = pausesByHabit ?? new Map<string, PausePeriod[]>();

  // Active = not currently paused. Paused habits are dormant: out of the score,
  // out of Top Habits, out of the active count.
  const active = allStatus.filter((h) => !h.is_paused);

  // ── Per-habit windows (30d now + previous 30d for trend), pause-aware ──
  const doneByHabit = new Map<string, Set<string>>();
  for (const c of recentCompletions ?? []) {
    const set = doneByHabit.get(c.habit_id) ?? new Set<string>();
    set.add(c.completed_date);
    doneByHabit.set(c.habit_id, set);
  }

  let done30 = 0;
  let exp30 = 0;
  let donePrev = 0;
  let expPrev = 0;
  const topRows: { habit: HabitWithStatus; rate: number | null }[] = [];

  for (const h of allStatus) {
    const done = doneByHabit.get(h.id) ?? new Set<string>();
    const hp = pauses.get(h.id) ?? [];
    const s30 = windowStats(h, done, hp, 0, 30);
    const sPrev = windowStats(h, done, hp, 30, 30);
    done30 += s30.done; exp30 += s30.expected;
    donePrev += sPrev.done; expPrev += sPrev.expected;
    if (!h.is_paused) {
      topRows.push({ habit: h, rate: s30.expected > 0 ? Math.min(s30.done / s30.expected, 1) : null });
    }
  }

  // Pooled consistency — robust against cold-start noise; paused days excluded.
  const consistency = exp30 > 0 ? done30 / exp30 : 0;
  const prevConsistency = expPrev > 0 ? donePrev / expPrev : 0;
  const maxCurrent = active.reduce((m, h) => Math.max(m, h.current_streak), 0);
  const maxBest = allStatus.reduce((m, h) => Math.max(m, h.best_streak), 0); // lifetime record
  const activeCount = active.length;

  const momentum = Math.min(maxCurrent / 30, 1);
  const breadth = Math.min(activeCount / 5, 1);
  const score = Math.round(100 * (0.7 * consistency + 0.2 * momentum + 0.1 * breadth));
  // Trend isolates recent behaviour change (consistency); momentum & breadth held
  // constant. Shown only when last month has a real sample (≥10 scheduled days).
  const prevScore = Math.round(100 * (0.7 * prevConsistency + 0.2 * momentum + 0.1 * breadth));
  const trend = expPrev >= 10 ? score - prevScore : null;

  // Top 5 active by current streak, then 30d rate.
  topRows.sort((a, b) => {
    if (b.habit.current_streak !== a.habit.current_streak) {
      return b.habit.current_streak - a.habit.current_streak;
    }
    return (b.rate ?? 0) - (a.rate ?? 0);
  });
  const top = topRows.slice(0, 5);

  // ── Year aggregates for the monthly + weekday charts ──
  const countMap = new Map(yearData.map((d) => [d.date, d.count]));
  const monthTotals = new Array(12).fill(0);
  const weekdayTotals = new Array(7).fill(0); // index 0 = Monday … 6 = Sunday
  for (const [date, count] of countMap) {
    const d = new Date(date + "T12:00:00");
    monthTotals[d.getMonth()] += count;
    weekdayTotals[(d.getDay() + 6) % 7] += count;
  }
  const maxMonthTotal = Math.max(...monthTotals, 1);
  let bestMonth = -1;
  let bestTotal = 0;
  monthTotals.forEach((t, m) => {
    if (t > bestTotal) { bestTotal = t; bestMonth = m; }
  });

  // ── Perfect days this year — every scheduled, active (non-paused) habit done ──
  const compByDay = new Map<string, Set<string>>();
  for (const c of yearComps) {
    const set = compByDay.get(c.completed_date) ?? new Set<string>();
    set.add(c.habit_id);
    compByDay.set(c.completed_date, set);
  }
  let perfectDays = 0;
  const cursor = new Date(`${yearStart}T12:00:00`);
  const end = new Date(`${todayStr}T12:00:00`);
  while (cursor <= end) {
    const ds = `${cursor.getFullYear()}-${pad(cursor.getMonth() + 1)}-${pad(cursor.getDate())}`;
    const daySet = compByDay.get(ds);
    let scheduled = 0;
    let doneCount = 0;
    for (const h of allStatus) {
      if (ds < h.created_at.slice(0, 10)) continue;
      if (!isExpectedOnDate(h, ds)) continue;
      if (isWithinAnyPause(ds, pauses.get(h.id) ?? [])) continue;
      scheduled++;
      if (daySet?.has(h.id)) doneCount++;
    }
    if (scheduled > 0 && doneCount === scheduled) perfectDays++;
    cursor.setDate(cursor.getDate() + 1);
  }

  const trendSub = trend !== null ? ` · ${trend > 0 ? "+" : ""}${trend}` : "";

  return (
    <div className="space-y-4">
      {/* Metric strip — uniform cards (Watching/Books grammar) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <MetricCard
          label="Habit Score"
          value={score}
          sub={`${scoreLabel(score)}${trendSub}`}
          icon={<Gauge size={14} style={{ color: ACCENT }} />}
        />
        <MetricCard
          label="Consistency"
          value={`${Math.round(consistency * 100)}%`}
          sub="30 days"
          icon={<Target size={14} style={{ color: ACCENT }} />}
        />
        <MetricCard
          label="Current streak"
          value={`${maxCurrent}d`}
          icon={<Flame size={14} style={{ color: FIRE }} />}
        />
        <MetricCard
          label="Longest streak"
          value={`${maxBest}d`}
          icon={<Trophy size={14} style={{ color: GOLD }} />}
        />
        <MetricCard
          label="Perfect days"
          value={perfectDays}
          sub={`in ${year}`}
          icon={<Sparkles size={14} style={{ color: ACCENT }} />}
        />
      </div>

      {/* Charts row — monthly rhythm · weekly pattern · top habits */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <MonthlyChart
          year={year}
          monthTotals={monthTotals}
          bestMonth={bestMonth}
          maxMonthTotal={maxMonthTotal}
          currentMonth={currentMonth}
        />
        <WeekdayChart data={weekdayTotals} />
        <TopHabitsChart rows={top} onOpen={openPanel} />
      </div>

      {/* Full-width heatmap — the Habits signature */}
      <AllHabitsHeatmap />

      {/* Achievements */}
      <HabitsAchievements />
    </div>
  );
}
