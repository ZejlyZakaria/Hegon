"use client";

import { useMemo } from "react";
import { Flame, Trophy, TrendingUp } from "lucide-react";
import { useHeatmapData } from "../hooks/useHabitStats";
import type { HabitWithStatus, HeatmapDay } from "../types";

const ACCENT    = "#f43f5e";
const DAYS_SHORT = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getWeekDates(): string[] {
  const today  = new Date();
  const dow    = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return toDateStr(d);
  });
}

// Rate → rose color (same scale as heatmap)
function rateToColor(pct: number): string {
  if (pct === 0)        return "#27272a";
  if (pct <= 25)        return "#4c0d1f";
  if (pct <= 50)        return "#881337";
  if (pct <= 75)        return "#be123c";
  if (pct < 100)        return "#e11d48";
  return "#f43f5e";
}

// ─── Weekly Rhythm (aggregate — 7 day blocks) ─────────────────────────────────

function isExpectedOnDate(habit: HabitWithStatus, date: string): boolean {
  if (habit.frequency === "daily") return true;
  const dow = new Date(date + "T12:00:00").getDay(); // noon → avoid tz edge case
  return habit.custom_days?.includes(dow) ?? false;
}

function WeeklyRhythm({
  habits,
  recentCompletions,
}: {
  habits:            HabitWithStatus[];
  recentCompletions: { habit_id: string; completed_date: string }[];
}) {
  const weekDates = useMemo(() => getWeekDates(), []);
  const todayStr  = toDateStr(new Date());

  // Per-day stats: how many habits were expected vs completed
  const dayStats = useMemo(() =>
    weekDates.map((date) => {
      const expected  = habits.filter((h) => isExpectedOnDate(h, date));
      const doneIds   = new Set(
        recentCompletions
          .filter((c) => c.completed_date === date)
          .map((c) => c.habit_id)
      );
      const done = expected.filter((h) => doneIds.has(h.id)).length;
      const pct  = expected.length > 0 ? Math.round((done / expected.length) * 100) : 0;
      return { date, total: expected.length, done, pct };
    }),
    [habits, recentCompletions, weekDates]
  );

  // Consistency = total done / total expected for past days
  const past          = dayStats.filter((d) => d.date <= todayStr && d.total > 0);
  const totalDone     = past.reduce((s, d) => s + d.done, 0);
  const totalExpected = past.reduce((s, d) => s + d.total, 0);
  const consistency   = totalExpected > 0 ? Math.round((totalDone / totalExpected) * 100) : 0;

  return (
    <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/60 p-3">
      <p className="text-xs font-semibold text-zinc-300 mb-2.5">Weekly Rhythm</p>

      {/* 7 day blocks */}
      <div className="flex gap-5">
        {dayStats.map(({ date, total, done, pct }, i) => {
          const future  = date > todayStr;
          const isToday = date === todayStr;
          const color   = rateToColor(pct);

          return (
            <div key={date} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="w-full h-9 rounded-lg transition-colors relative"
                style={{
                  backgroundColor: future   ? "transparent" : color,
                  border: future
                    ? "1px dashed #3f3f4640"
                    : isToday
                    ? `1px solid ${pct > 0 ? color : "#52525b"}`
                    : undefined,
                  boxShadow: isToday && pct > 0 ? `0 0 6px ${color}50` : undefined,
                }}
                title={!future && total > 0 ? `${done}/${total} habits` : undefined}
              />
              <span
                className="text-[9px] font-medium"
                style={{ color: isToday ? "#d4d4d8" : "#52525b" }}
              >
                {DAYS_SHORT[i]}
              </span>
            </div>
          );
        })}
      </div>

      <p className="text-[10px] text-zinc-600 mt-2">
        Consistency this week:{" "}
        <span
          className="font-semibold"
          style={{
            color:
              consistency >= 70 ? "#4ade80"
              : consistency >= 40 ? "#f59e0b"
              : ACCENT,
          }}
        >
          {consistency}%
        </span>
      </p>
    </div>
  );
}

// ─── Quick Stats ───────────────────────────────────────────────────────────────

function QuickStats({
  habits,
  recentCompletions,
}: {
  habits:            HabitWithStatus[];
  recentCompletions: { habit_id: string; completed_date: string }[];
}) {
  const { maxCurrent, maxBest, rate30 } = useMemo(() => {
    if (habits.length === 0) return { maxCurrent: 0, maxBest: 0, rate30: 0 };

    const maxCurrent = Math.max(...habits.map((h) => h.current_streak));
    const maxBest    = Math.max(...habits.map((h) => h.best_streak));

    const d = new Date();
    d.setDate(d.getDate() - 29);
    const from30  = toDateStr(d);
    const count30 = recentCompletions.filter((c) => c.completed_date >= from30).length;
    const rate30  = Math.min(Math.round((count30 / (habits.length * 30)) * 100), 100);

    return { maxCurrent, maxBest, rate30 };
  }, [habits, recentCompletions]);

  const stats = [
    { icon: <Flame size={14} />,      value: `${maxCurrent}d`, label: "Current Streak", color: "#f97316" },
    { icon: <Trophy size={14} />,     value: `${maxBest}d`,    label: "Best Streak",    color: "#eab308" },
    { icon: <TrendingUp size={14} />, value: `${rate30}%`,     label: "30-day Rate",    color: ACCENT    },
  ];

  return (
    <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/60 p-3">
      <p className="text-xs font-semibold text-zinc-300 mb-2">Quick Stats</p>
      <div className="grid grid-cols-3 divide-x divide-zinc-800/60">
        {stats.map(({ icon, value, label, color }) => (
          <div key={label} className="flex flex-col items-center gap-0.5 py-1 px-1">
            <span style={{ color }}>{icon}</span>
            <span className="text-sm font-bold text-zinc-200 mt-0.5">{value}</span>
            <span className="text-[9px] text-zinc-600 text-center leading-tight mt-0.5">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Compact Heatmap (4 months, fills available width) ────────────────────────

function getHeatmapCellColor(count: number): string {
  if (count === 0) return "#1c1c1e";
  if (count === 1) return "#4c0d1f";
  if (count === 2) return "#881337";
  if (count <= 4)  return "#be123c";
  return "#f43f5e";
}

function buildHeatmapGrid(data: HeatmapDay[]) {
  const today    = new Date();
  const todayStr = toDateStr(today);
  const countMap = new Map(data.map((d) => [d.date, d.count]));

  // 6 months ago, rounded back to Monday
  const start = new Date(today);
  start.setMonth(start.getMonth() - 6);
  while (start.getDay() !== 1) start.setDate(start.getDate() - 1);

  const weeks: Array<Array<{ date: string; count: number } | null>> = [];
  const cur = new Date(start);

  while (toDateStr(cur) <= todayStr) {
    const week: Array<{ date: string; count: number } | null> = [];
    for (let d = 0; d < 7; d++) {
      const ds = toDateStr(cur);
      week.push(ds > todayStr ? null : { date: ds, count: countMap.get(ds) ?? 0 });
      cur.setDate(cur.getDate() + 1);
    }
    weeks.push(week);
  }

  return weeks;
}

function CompactHeatmap() {
  const { data, isLoading } = useHeatmapData();

  const { weeks, totalCompletions, monthLabels } = useMemo(() => {
    const weeks            = buildHeatmapGrid(data);
    const totalCompletions = data.reduce((s, d) => s + d.count, 0);

    const monthLabels: { col: number; label: string }[] = [];
    let lastMonth = -1;
    weeks.forEach((week, wi) => {
      const first = week.find((d) => d !== null);
      if (first) {
        const m = new Date(first.date).getMonth();
        if (m !== lastMonth) {
          monthLabels.push({
            col:   wi,
            label: new Date(first.date).toLocaleString("default", { month: "short" }),
          });
          lastMonth = m;
        }
      }
    });

    return { weeks, totalCompletions, monthLabels };
  }, [data]);

  if (isLoading) return null;

  const nWeeks = weeks.length; // ~17-18 for 4 months

  return (
    <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/60 p-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-xs font-semibold text-zinc-300">All Habits Heatmap</p>
        <p className="text-[10px] text-zinc-600">Last 6 months</p>
      </div>

      {/* Month labels */}
      <div className="relative h-3 mb-0.5 overflow-hidden">
        {monthLabels.map(({ col, label }) => (
          <span
            key={col}
            className="absolute text-[8px] text-zinc-600"
            style={{ left: `${(col / nWeeks) * 100}%` }}
          >
            {label}
          </span>
        ))}
      </div>

      {/* Grid + day labels */}
      <div className="flex gap-1.5">

        {/* Day labels */}
        <div className="flex flex-col gap-0.5 shrink-0">
          {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => (
            <div
              key={d}
              className="text-[8px] text-zinc-700 flex items-center justify-end"
              style={{ height: "calc((100% - 12px) / 7)" }}
            >
              {d}
            </div>
          ))}
        </div>

        {/* Week columns — flex-1 fills available width */}
        <div className="flex-1 flex gap-0.5">
          {weeks.map((week, wi) => (
            <div key={wi} className="flex-1 flex flex-col gap-0.5">
              {week.map((cell, di) => (
                <div
                  key={di}
                  className="w-full rounded-[2px]"
                  style={{
                    aspectRatio:     "1",
                    backgroundColor: cell === null ? "transparent" : getHeatmapCellColor(cell.count),
                  }}
                  title={cell ? `${cell.date}: ${cell.count}` : undefined}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-1">
          <span className="text-[9px] text-zinc-700">Less</span>
          {[0, 1, 2, 3, 5].map((n) => (
            <div
              key={n}
              className="rounded-[2px]"
              style={{ width: 8, height: 8, backgroundColor: getHeatmapCellColor(n), flexShrink: 0 }}
            />
          ))}
          <span className="text-[9px] text-zinc-700">More</span>
        </div>
        <p className="text-[9px] text-zinc-600">
          Total:{" "}
          <span className="text-zinc-400 font-medium">{totalCompletions.toLocaleString()}</span>
        </p>
      </div>
    </div>
  );
}

// ─── Export ────────────────────────────────────────────────────────────────────

interface HabitsRightPanelProps {
  habits:            HabitWithStatus[];
  recentCompletions: { habit_id: string; completed_date: string }[];
}

export function HabitsRightPanel({ habits, recentCompletions }: HabitsRightPanelProps) {
  if (habits.length === 0) return null;

  return (
    <div className="space-y-3">
      <WeeklyRhythm habits={habits} recentCompletions={recentCompletions} />
      <QuickStats   habits={habits} recentCompletions={recentCompletions} />
      <CompactHeatmap />
    </div>
  );
}
