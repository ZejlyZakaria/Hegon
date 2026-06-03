"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Flame,
  CalendarCheck,
  Star,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronRight,
} from "lucide-react";
import { resolveIcon } from "@/shared/constants/icons";
import { cn } from "@/shared/utils/utils";
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
const UP = "#22c55e";

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

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

// ─── Score hero ─────────────────────────────────────────────────────────────

function ScoreHero({
  score,
  trend,
  consistency,
  currentStreak,
  habitCount,
}: {
  score: number;
  trend: number | null;
  consistency: number;
  currentStreak: number;
  habitCount: number;
}) {
  const R = 52;
  const C = 2 * Math.PI * R;
  const dash = (score / 100) * C;
  const label = scoreLabel(score);

  const TrendIcon = trend === null ? Minus : trend > 0 ? TrendingUp : trend < 0 ? TrendingDown : Minus;
  const trendColor = trend === null || trend === 0 ? "var(--color-text-tertiary)" : trend > 0 ? UP : "#f87171";

  return (
    <div className="rounded-2xl bg-surface-1 p-5">
      <div className="flex items-center gap-6">
        {/* Ring */}
        <div className="relative h-32 w-32 shrink-0">
          <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r={R} fill="none" stroke="var(--color-surface-3)" strokeWidth="9" />
            <circle
              cx="60"
              cy="60"
              r={R}
              fill="none"
              stroke={ACCENT}
              strokeWidth="9"
              strokeLinecap="round"
              strokeDasharray={`${dash} ${C}`}
              className="transition-[stroke-dasharray] duration-700 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
            <span className="text-4xl font-bold tabular-nums tracking-tight text-text-primary">{score}</span>
            <span className="mt-1 text-[10px] font-medium uppercase tracking-wider text-text-tertiary">/ 100</span>
          </div>
        </div>

        {/* Meaning */}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-text-tertiary">Habit Score</p>
          <div className="mt-1 flex items-center gap-2.5">
            <h3 className="text-2xl font-bold tracking-tight" style={{ color: ACCENT }}>{label}</h3>
            {trend !== null && (
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold"
                style={{
                  color: trendColor,
                  backgroundColor: `color-mix(in srgb, ${trendColor} 16%, transparent)`,
                }}
              >
                <TrendIcon size={12} />
                {trend > 0 ? `+${trend}` : trend}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-text-tertiary">
            {trend === null ? "Your momentum across every habit" : "vs your previous 30 days"}
          </p>

          {/* Transparent breakdown — the three ingredients that make the score */}
          <div className="mt-4 grid grid-cols-3 gap-2 pt-1">
            <Breakdown value={`${Math.round(consistency * 100)}%`} label="Consistency" />
            <Breakdown value={`${currentStreak}d`} label="Streak" color={currentStreak > 0 ? FIRE : undefined} />
            <Breakdown value={String(habitCount)} label={habitCount === 1 ? "Habit" : "Habits"} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Breakdown({ value, label, color }: { value: string; label: string; color?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-base font-bold tabular-nums text-text-primary" style={color ? { color } : undefined}>
        {value}
      </p>
      <p className="mt-0.5 truncate text-[10px] uppercase tracking-wider text-text-tertiary">{label}</p>
    </div>
  );
}

// ─── Top habits ─────────────────────────────────────────────────────────────

function TopHabits({
  rows,
  onOpen,
}: {
  rows: { habit: HabitWithStatus; rate: number | null }[];
  onOpen: (id: string) => void;
}) {
  return (
    <div className="flex flex-col rounded-2xl border border-border-subtle bg-surface-1 p-5">
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-text-primary">Top Habits</h3>
        <span className="text-[11px] text-text-tertiary">by streak</span>
      </div>

      {rows.length === 0 ? (
        <p className="flex flex-1 items-center justify-center py-6 text-center text-sm text-text-tertiary">
          No active habits.
        </p>
      ) : (
        <div className="flex flex-1 flex-col gap-1">
          {rows.map(({ habit, rate }) => {
            const { icon: Icon, color } = resolveIcon(habit.icon);
            return (
              <button
                key={habit.id}
                type="button"
                onClick={() => onOpen(habit.id)}
                className="group flex items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors duration-150 ease-out hover:bg-surface-2"
              >
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                  style={{ backgroundColor: `color-mix(in srgb, ${color} 16%, transparent)`, color }}
                >
                  <Icon size={15} />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-text-primary">{habit.title}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <div className="h-1 flex-1 overflow-hidden rounded-full bg-surface-2">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${(rate ?? 0) * 100}%`, backgroundColor: ACCENT }}
                      />
                    </div>
                    <span className="w-8 shrink-0 text-right text-[10px] tabular-nums text-text-tertiary">
                      {rate === null ? "—" : `${Math.round(rate * 100)}%`}
                    </span>
                  </div>
                </div>

                <div className="flex w-10 shrink-0 items-center justify-end gap-1">
                  <Flame size={13} style={{ color: habit.current_streak > 0 ? FIRE : "var(--color-text-tertiary)" }} />
                  <span
                    className="text-sm font-bold tabular-nums"
                    style={{ color: habit.current_streak > 0 ? FIRE : "var(--color-text-secondary)" }}
                  >
                    {habit.current_streak}
                  </span>
                </div>

                <ChevronRight
                  size={14}
                  className="shrink-0 text-text-tertiary opacity-0 transition-opacity group-hover:opacity-100"
                />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Metric tiles ───────────────────────────────────────────────────────────

function MetricTile({
  icon,
  color,
  value,
  label,
}: {
  icon: React.ReactNode;
  color: string;
  value: string;
  label: string;
}) {
  return (
    <div className="flex flex-col justify-between rounded-2xl border border-border-subtle bg-surface-1 p-4">
      <div
        className="flex h-8 w-8 items-center justify-center rounded-lg"
        style={{ backgroundColor: `color-mix(in srgb, ${color} 16%, transparent)`, color }}
      >
        {icon}
      </div>
      <div className="mt-4 min-w-0">
        <p className="truncate text-xl font-bold tabular-nums text-text-primary">{value}</p>
        <p className="mt-0.5 text-[10px] uppercase tracking-wider text-text-tertiary">{label}</p>
      </div>
    </div>
  );
}

// ─── Monthly bar chart ──────────────────────────────────────────────────────

function MonthlyBarChart({
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
    <div className="flex h-full flex-col rounded-2xl border border-border-subtle bg-surface-1 p-5">
      <div className="mb-5 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-text-primary">Monthly rhythm</h3>
        <span className="text-[11px] text-text-tertiary">{year}</span>
      </div>

      <div className="flex flex-1 items-stretch gap-1.5">
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
              className={cn(
                "group relative flex flex-1 flex-col",
                isFuture ? "cursor-default" : "cursor-pointer",
              )}
            >
              {/* faint full-height track — every month is a designed slot, so
                  empty months read as zero, not as a hole in the chart */}
              <div
                className="relative flex w-full flex-1 items-end overflow-hidden rounded-md"
                style={{
                  backgroundColor: `color-mix(in srgb, var(--color-surface-2) ${isFuture ? 28 : 55}%, transparent)`,
                }}
              >
                {hasData && (
                  <div
                    className="w-full rounded-md transition-[height] duration-500 ease-out group-hover:brightness-110"
                    style={{
                      height: `${heightPct}%`,
                      backgroundColor: isBest
                        ? ACCENT
                        : `color-mix(in srgb, ${ACCENT} ${48 + Math.round((total / maxMonthTotal) * 42)}%, var(--color-surface-2))`,
                    }}
                  />
                )}

                {/* value on hover */}
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

      <p className="mt-4 text-[11px] text-text-tertiary">
        {maxMonthTotal > 0 ? "Tap any month for the full report." : "Log habits to see your monthly rhythm."}
      </p>
    </div>
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
  // constant. Shown only when last month has a real sample (≥10 scheduled days),
  // so the number is always a genuine stat, never a divide-by-empty artefact.
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

  // ── Year aggregates for tiles + bar chart ──
  const countMap = new Map(yearData.map((d) => [d.date, d.count]));
  const monthTotals = new Array(12).fill(0);
  for (const [date, count] of countMap) {
    monthTotals[new Date(date + "T12:00:00").getMonth()] += count;
  }
  const yearTotal = monthTotals.reduce((s, t) => s + t, 0);
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

  return (
    <div className="space-y-8">
      {/* Row 1 — Score hero + Top Habits */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.35fr_1fr]">
        <ScoreHero
          score={score}
          trend={trend}
          consistency={consistency}
          currentStreak={maxCurrent}
          habitCount={activeCount}
        />
        <TopHabits rows={top} onOpen={openPanel} />
      </div>

      {/* Row 2 — full-width heatmap */}
      <AllHabitsHeatmap />

      {/* Row 3 — monthly bar chart (½) + metric tiles 2×2 (½) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <MonthlyBarChart
          year={year}
          monthTotals={monthTotals}
          bestMonth={bestMonth}
          maxMonthTotal={maxMonthTotal}
          currentMonth={currentMonth}
        />

        <div className="grid grid-cols-2 gap-3">
          <MetricTile icon={<Flame size={16} />} color={FIRE} value={`${maxBest}d`} label="Longest streak" />
          <MetricTile icon={<Sparkles size={16} />} color={ACCENT} value={String(perfectDays)} label="Perfect days" />
          <MetricTile icon={<CalendarCheck size={16} />} color={ACCENT} value={yearTotal.toLocaleString()} label="This year" />
          <MetricTile icon={<Star size={16} />} color={GOLD} value={bestMonth >= 0 ? MONTHS_LONG[bestMonth] : "—"} label="Best month" />
        </div>
      </div>

      {/* Row 4 — achievements */}
      <HabitsAchievements />
    </div>
  );
}
