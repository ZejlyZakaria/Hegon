"use client";

import { useMemo } from "react";
import { useHeatmapData } from "../hooks/useHabitStats";
import { toDateStr, isExpectedOnDate } from "../utils";
import type { HabitWithStatus, HeatmapDay } from "../types";

const ACCENT = "var(--color-accent-habits)";
const DAYS_SHORT = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const RING_R = 38;
const RING_C = 2 * Math.PI * RING_R;

function getWeekDates(): string[] {
  const today = new Date();
  const dow = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return toDateStr(d);
  });
}

// ─── Habit Streak ─────────────────────────────────────────────────────────────

function HabitStreakCard({
  habits,
  recentCompletions,
}: {
  habits: HabitWithStatus[];
  recentCompletions: { habit_id: string; completed_date: string }[];
}) {
  const weekDates = useMemo(() => getWeekDates(), []);
  const todayStr = toDateStr(new Date());

  const { maxCurrent, maxBest } = useMemo(() => {
    if (habits.length === 0) return { maxCurrent: 0, maxBest: 0 };
    return {
      maxCurrent: Math.max(...habits.map((h) => h.current_streak)),
      maxBest: Math.max(...habits.map((h) => h.best_streak)),
    };
  }, [habits]);

  const weekDots = useMemo(() => {
    const completionDates = new Set(recentCompletions.map((c) => c.completed_date));
    return weekDates.map((date, i) => ({
      label: DAYS_SHORT[i],
      active: date <= todayStr && completionDates.has(date),
      future: date > todayStr,
    }));
  }, [weekDates, recentCompletions, todayStr]);

  return (
    <div className="bg-surface-1 rounded-lg p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-text-secondary">Habit Streak</h3>
        <span className="text-xs text-text-tertiary">Best {maxBest}d</span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-3xl font-bold text-text-primary">{maxCurrent}</span>
        <span className="text-sm" style={{ color: ACCENT }}>days</span>
      </div>
      <div className="flex items-center justify-between">
        {weekDots.map((dot, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <span className="text-[10px] text-text-tertiary">{dot.label}</span>
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: dot.active ? ACCENT : "#27272a" }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── This Month ───────────────────────────────────────────────────────────────

function ThisMonthCard({
  habits,
  recentCompletions,
}: {
  habits: HabitWithStatus[];
  recentCompletions: { habit_id: string; completed_date: string }[];
}) {
  const { completionsMonth, rate } = useMemo(() => {
    const today = new Date();
    const monthStart = toDateStr(new Date(today.getFullYear(), today.getMonth(), 1));
    const todayStr = toDateStr(today);

    const completionsMonth = recentCompletions.filter(
      (c) => c.completed_date >= monthStart && c.completed_date <= todayStr,
    ).length;

    let expectedMonth = 0;
    const cur = new Date(today.getFullYear(), today.getMonth(), 1);
    while (toDateStr(cur) <= todayStr) {
      expectedMonth += habits.filter((h) => isExpectedOnDate(h, toDateStr(cur))).length;
      cur.setDate(cur.getDate() + 1);
    }

    const rate = expectedMonth > 0 ? Math.round((completionsMonth / expectedMonth) * 100) : 0;
    return { completionsMonth, rate };
  }, [habits, recentCompletions]);

  const dash = Math.min(rate / 100, 1) * RING_C;

  return (
    <div className="bg-surface-1 rounded-lg p-4 flex flex-col gap-3">
      <h3 className="text-xs font-semibold text-text-secondary">This Month</h3>
      <div className="flex items-center justify-center">
        <div className="relative w-24 h-24">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 96 96">
            <circle cx="48" cy="48" r={RING_R} fill="none" stroke="#27272a" strokeWidth="7" />
            <circle
              cx="48" cy="48" r={RING_R}
              fill="none"
              stroke={ACCENT}
              strokeWidth="7"
              strokeDasharray={`${dash} ${RING_C}`}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-bold text-text-primary">{rate}%</span>
            <span className="text-[10px] text-text-tertiary">rate</span>
          </div>
        </div>
      </div>
      <p className="text-center text-xs text-text-tertiary">
        <span className="font-semibold text-text-secondary">{completionsMonth}</span>{" "}
        completions
      </p>
    </div>
  );
}

// ─── Compact Heatmap ─────────────────────────────────────────────────────────

function getHeatmapCellColor(count: number): string {
  if (count === 0) return "var(--color-surface-2)";
  if (count === 1) return "#4c0d1f";
  if (count === 2) return "#881337";
  if (count <= 4) return "#be123c";
  return ACCENT;
}

type GridCell = { date: string; count: number } | null;
type MonthLabel = { col: number; label: string };

function buildHeatmapGrid(data: HeatmapDay[]) {
  const today = new Date();
  const todayStr = toDateStr(today);
  const countMap = new Map(data.map((d) => [d.date, d.count]));

  const start = new Date(today);
  start.setMonth(start.getMonth() - 3);
  while (start.getDay() !== 1) start.setDate(start.getDate() - 1);

  const weeks: GridCell[][] = [];
  const cur = new Date(start);

  while (toDateStr(cur) <= todayStr) {
    const week: GridCell[] = [];
    for (let d = 0; d < 7; d++) {
      const ds = toDateStr(cur);
      week.push(
        ds > todayStr ? null : { date: ds, count: countMap.get(ds) ?? 0 },
      );
      cur.setDate(cur.getDate() + 1);
    }
    weeks.push(week);
  }

  return weeks;
}

function buildMonthLabels(weeks: GridCell[][]): MonthLabel[] {
  const labels: MonthLabel[] = [];
  let lastMonth = -1;

  weeks.forEach((week, wi) => {
    const first = week.find((d) => d !== null);
    if (!first) return;

    const month = new Date(first.date).getMonth();
    if (month !== lastMonth) {
      labels.push({
        col: wi,
        label: new Date(first.date).toLocaleString("default", { month: "short" }),
      });
      lastMonth = month;
    }
  });

  return labels;
}

function CompactHeatmap() {
  const { data, isLoading } = useHeatmapData();

  const { weeks, totalCompletions, monthLabels } = useMemo(() => {
    const weeks = buildHeatmapGrid(data);
    const totalCompletions = data.reduce((s, d) => s + d.count, 0);
    const monthLabels = buildMonthLabels(weeks);
    return { weeks, totalCompletions, monthLabels };
  }, [data]);

  const GAP = 2;

  if (isLoading) return null;

  return (
    <div className="bg-surface-1 rounded-lg p-4">
      <p className="mb-3 text-xs font-semibold text-text-secondary">
        All Habits Heatmap
      </p>

      <div className="flex gap-2">
        <div
          className="mt-3.5 flex shrink-0 flex-col justify-between"
          style={{ gap: GAP }}
        >
          {DAYS_SHORT.map((d) => (
            <div
              key={d}
              className="flex items-center justify-end text-[8px] leading-none text-text-tertiary"
              style={{ height: 9 }}
            >
              {d}
            </div>
          ))}
        </div>

        <div className="flex-1 min-w-0">
          <div className="relative mb-1 h-2.5">
            {monthLabels.map((month) => (
              <div
                key={`${month.col}-${month.label}`}
                className="absolute text-[8px] leading-none text-text-tertiary"
                style={{
                  left: `${(month.col / Math.max(weeks.length, 1)) * 100}%`,
                }}
              >
                {month.label}
              </div>
            ))}
          </div>

          <div className="flex" style={{ gap: GAP }}>
            {weeks.map((week, wi) => (
              <div
                key={wi}
                className="flex flex-1 flex-col"
                style={{ gap: GAP, minWidth: 0 }}
              >
                {week.map((cell, di) => (
                  <div
                    key={di}
                    className="w-full rounded-xs"
                    style={{
                      aspectRatio: "1 / 1",
                      backgroundColor:
                        cell === null
                          ? "transparent"
                          : getHeatmapCellColor(cell.count),
                    }}
                    title={cell ? `${cell.date}: ${cell.count}` : undefined}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <span className="text-[9px] text-text-tertiary">Less</span>
          {[0, 1, 2, 3, 5].map((n) => (
            <div
              key={n}
              className="shrink-0 rounded-xs"
              style={{ width: 8, height: 8, backgroundColor: getHeatmapCellColor(n) }}
            />
          ))}
          <span className="text-[9px] text-text-tertiary">More</span>
        </div>
        <p className="text-[9px] text-text-tertiary">
          Total{" "}
          <span className="font-medium text-text-secondary">
            {totalCompletions.toLocaleString()}
          </span>
        </p>
      </div>
    </div>
  );
}

// ─── Right Panel ─────────────────────────────────────────────────────────────

interface HabitsRightPanelProps {
  habits: HabitWithStatus[];
  recentCompletions: { habit_id: string; completed_date: string }[];
}

export function HabitsRightPanel({
  habits,
  recentCompletions,
}: HabitsRightPanelProps) {
  if (habits.length === 0) return null;

  return (
    <div className="space-y-3">
      <HabitStreakCard habits={habits} recentCompletions={recentCompletions} />
      <ThisMonthCard habits={habits} recentCompletions={recentCompletions} />
      <CompactHeatmap />
    </div>
  );
}
