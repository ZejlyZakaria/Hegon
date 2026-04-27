"use client";

import { useMemo } from "react";
import { Flame, Trophy, TrendingUp } from "lucide-react";
import { useHeatmapData } from "../hooks/useHabitStats";
import { toDateStr, isExpectedOnDate } from "../utils";
import type { HabitWithStatus, HeatmapDay } from "../types";

const ACCENT = "var(--color-accent-habits)";
const DAYS_SHORT = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

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

function rateToColor(pct: number): string {
  if (pct === 0) return "var(--color-surface-2)";
  if (pct <= 25) return "#4c0d1f";
  if (pct <= 50) return "#881337";
  if (pct <= 75) return "#be123c";
  if (pct < 100) return "#e11d48";
  return ACCENT;
}

function WeeklyRhythm({
  habits,
  recentCompletions,
}: {
  habits: HabitWithStatus[];
  recentCompletions: { habit_id: string; completed_date: string }[];
}) {
  const weekDates = useMemo(() => getWeekDates(), []);
  const todayStr = toDateStr(new Date());

  const dayStats = useMemo(
    () =>
      weekDates.map((date) => {
        const expected = habits.filter((h) => isExpectedOnDate(h, date));
        const doneIds = new Set(
          recentCompletions
            .filter((c) => c.completed_date === date)
            .map((c) => c.habit_id),
        );

        const done = expected.filter((h) => doneIds.has(h.id)).length;
        const pct =
          expected.length > 0 ? Math.round((done / expected.length) * 100) : 0;

        return { date, total: expected.length, done, pct };
      }),
    [habits, recentCompletions, weekDates],
  );

  const past = dayStats.filter((d) => d.date <= todayStr && d.total > 0);
  const totalDone = past.reduce((s, d) => s + d.done, 0);
  const totalExpected = past.reduce((s, d) => s + d.total, 0);
  const consistency =
    totalExpected > 0 ? Math.round((totalDone / totalExpected) * 100) : 0;

  return (
    <div
      className="rounded-lg border p-3"
      style={{
        backgroundColor: "var(--color-surface-1)",
        borderColor: "var(--color-border-subtle)",
      }}
    >
      <p className="mb-2 text-xs font-semibold text-text-secondary">
        Weekly Rhythm
      </p>

      <div className="flex gap-3">
        {dayStats.map(({ date, total, done, pct }, i) => {
          const future = date > todayStr;
          const isToday = date === todayStr;
          const color = rateToColor(pct);

          return (
            <div key={date} className="flex flex-1 flex-col items-center gap-1">
              <div
                className="relative h-9 w-full rounded-md transition-colors"
                style={{
                  backgroundColor: future ? "transparent" : color,
                  border: future
                    ? "1px dashed rgba(255,255,255,0.10)"
                    : isToday
                      ? `1px solid ${pct > 0 ? color : "rgba(255,255,255,0.20)"}`
                      : undefined,
                  boxShadow:
                    isToday && pct > 0 ? `0 0 6px ${color}40` : undefined,
                }}
                title={
                  !future && total > 0 ? `${done}/${total} habits` : undefined
                }
              />
              <span
                className="text-[9px] font-medium"
                style={{
                  color: isToday
                    ? "var(--color-text-secondary)"
                    : "var(--color-text-tertiary)",
                }}
              >
                {DAYS_SHORT[i]}
              </span>
            </div>
          );
        })}
      </div>

      <p
        className="mt-2 text-[10px]"
        style={{ color: "var(--color-text-tertiary)" }}
      >
        Consistency this week{" "}
        <span
          className="font-semibold"
          style={{
            color:
              consistency >= 70
                ? "#4ade80"
                : consistency >= 40
                  ? "#f59e0b"
                  : ACCENT,
          }}
        >
          {consistency}%
        </span>
      </p>
    </div>
  );
}

function QuickStats({
  habits,
  recentCompletions,
}: {
  habits: HabitWithStatus[];
  recentCompletions: { habit_id: string; completed_date: string }[];
}) {
  const { maxCurrent, maxBest, rate30 } = useMemo(() => {
    if (habits.length === 0) return { maxCurrent: 0, maxBest: 0, rate30: 0 };

    const maxCurrent = Math.max(...habits.map((h) => h.current_streak));
    const maxBest = Math.max(...habits.map((h) => h.best_streak));

    const d = new Date();
    d.setDate(d.getDate() - 29);
    const from30 = toDateStr(d);
    const count30 = recentCompletions.filter(
      (c) => c.completed_date >= from30,
    ).length;
    const rate30 = Math.min(
      Math.round((count30 / (habits.length * 30)) * 100),
      100,
    );

    return { maxCurrent, maxBest, rate30 };
  }, [habits, recentCompletions]);

  const stats = [
    {
      icon: <Flame size={14} />,
      value: `${maxCurrent}d`,
      label: "Current Streak",
      color: "#f97316",
    },
    {
      icon: <Trophy size={14} />,
      value: `${maxBest}d`,
      label: "Best Streak",
      color: "#eab308",
    },
    {
      icon: <TrendingUp size={14} />,
      value: `${rate30}%`,
      label: "30-day Rate",
      color: ACCENT,
    },
  ];

  return (
    <div
      className="rounded-lg border p-3"
      style={{
        backgroundColor: "var(--color-surface-1)",
        borderColor: "var(--color-border-subtle)",
      }}
    >
      <p className="mb-2 text-xs font-semibold text-text-secondary">
        Quick Stats
      </p>

      <div
        className="grid grid-cols-3"
        style={{ borderColor: "var(--color-border-default)" }}
      >
        {stats.map(({ icon, value, label, color }, index) => (
          <div
            key={label}
            className="flex flex-col items-center gap-0.5 px-1 py-1"
            style={{
              borderLeft:
                index === 0 ? "none" : "1px solid rgba(255,255,255,0.07)",
            }}
          >
            <span style={{ color }}>{icon}</span>
            <span
              className="mt-0.5 text-sm font-bold"
              style={{ color: "var(--color-text-primary)" }}
            >
              {value}
            </span>
            <span
              className="mt-0.5 text-center text-[9px] leading-tight"
              style={{ color: "var(--color-text-tertiary)" }}
            >
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

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
  start.setMonth(start.getMonth() - 6);
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
        label: new Date(first.date).toLocaleString("default", {
          month: "short",
        }),
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
    <div
      className="rounded-lg border p-3"
      style={{
        backgroundColor: "var(--color-surface-1)",
        borderColor: "var(--color-border-subtle)",
      }}
    >
      <p className="mb-2 text-xs font-semibold text-text-secondary">
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
              className="flex items-center justify-end text-[8px] leading-none"
              style={{
                height: 9,
                color: "var(--color-text-tertiary)",
              }}
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
                className="absolute text-[8px] leading-none"
                style={{
                  left: `${(month.col / Math.max(weeks.length, 1)) * 100}%`,
                  color: "var(--color-text-tertiary)",
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

      <div className="mt-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <span
            className="text-[9px]"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            Less
          </span>
          {[0, 1, 2, 3, 5].map((n) => (
            <div
              key={n}
              className="shrink-0 rounded-xs"
              style={{
                width: 8,
                height: 8,
                backgroundColor: getHeatmapCellColor(n),
              }}
            />
          ))}
          <span
            className="text-[9px]"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            More
          </span>
        </div>

        <p
          className="text-[9px]"
          style={{ color: "var(--color-text-tertiary)" }}
        >
          Total{" "}
          <span
            className="font-medium"
            style={{ color: "var(--color-text-secondary)" }}
          >
            {totalCompletions.toLocaleString()}
          </span>
        </p>
      </div>
    </div>
  );
}

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
      <WeeklyRhythm habits={habits} recentCompletions={recentCompletions} />
      <QuickStats habits={habits} recentCompletions={recentCompletions} />
      <CompactHeatmap />
    </div>
  );
}
