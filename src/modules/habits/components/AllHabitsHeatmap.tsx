"use client";

import { useMemo } from "react";
import { useHeatmapData } from "../hooks/useHabitStats";
import type { HeatmapDay } from "../types";

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getCellColor(count: number): string {
  if (count === 0) return "#1c1c1e";
  if (count === 1) return "#4c0d1f";
  if (count === 2) return "#881337";
  if (count <= 4)  return "#be123c";
  return "#f43f5e";
}

// Full-size cell for the All Habits tab
const CELL = 16;
const GAP  = 3;
const ROWS = 7;

function buildGrid(data: HeatmapDay[]) {
  const today    = new Date();
  const todayStr = toDateStr(today);
  const countMap = new Map(data.map((d) => [d.date, d.count]));

  // 6 months ago → Monday
  const start = new Date(today);
  start.setMonth(start.getMonth() - 6);
  while (start.getDay() !== 1) start.setDate(start.getDate() - 1);

  const weeks: Array<Array<{ date: string; count: number } | null>> = [];
  const cur = new Date(start);

  while (toDateStr(cur) <= todayStr) {
    const week: Array<{ date: string; count: number } | null> = [];
    for (let d = 0; d < ROWS; d++) {
      const ds = toDateStr(cur);
      week.push(ds > todayStr ? null : { date: ds, count: countMap.get(ds) ?? 0 });
      cur.setDate(cur.getDate() + 1);
    }
    weeks.push(week);
  }

  return weeks;
}

function buildMonthLabels(weeks: ReturnType<typeof buildGrid>) {
  const labels: { col: number; label: string }[] = [];
  let lastMonth = -1;
  weeks.forEach((week, wi) => {
    const first = week.find((d) => d !== null);
    if (first) {
      const m = new Date(first.date).getMonth();
      if (m !== lastMonth) {
        labels.push({
          col:   wi,
          label: new Date(first.date).toLocaleString("default", { month: "long" }),
        });
        lastMonth = m;
      }
    }
  });
  return labels;
}

const DAY_LABELS = ["Mon", "", "Wed", "", "Fri", "", "Sun"];

export function AllHabitsHeatmap() {
  const { data, isLoading } = useHeatmapData();

  const { weeks, totalCompletions, monthLabels } = useMemo(() => {
    const weeks            = buildGrid(data);
    const totalCompletions = data.reduce((s, d) => s + d.count, 0);
    const monthLabels      = buildMonthLabels(weeks);
    return { weeks, totalCompletions, monthLabels };
  }, [data]);

  if (isLoading) {
    return (
      <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/60 p-5 animate-pulse h-44" />
    );
  }

  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/60 p-10 text-center">
        <p className="text-sm text-zinc-600">No completions yet — start building your streak!</p>
      </div>
    );
  }

  const gridHeight = ROWS * (CELL + GAP) - GAP;

  return (
    <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/60 p-5">

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <p className="text-sm font-semibold text-zinc-200">All Habits Heatmap</p>
        <p className="text-xs text-zinc-600">Last 6 months</p>
      </div>

      {/* Grid + day labels */}
      <div className="flex gap-3">

        {/* Day labels column */}
        <div className="flex flex-col shrink-0 mt-6" style={{ gap: GAP }}>
          {DAY_LABELS.map((label, i) => (
            <div
              key={i}
              className="text-[10px] text-zinc-600 flex items-center justify-end"
              style={{ height: CELL, width: 26 }}
            >
              {label}
            </div>
          ))}
        </div>

        {/* Weeks */}
        <div className="flex-1 min-w-0">

          {/* Month labels */}
          <div className="flex mb-1" style={{ gap: GAP }}>
            {weeks.map((week, wi) => {
              const label = monthLabels.find((m) => m.col === wi);
              return (
                <div
                  key={wi}
                  className="flex-1 text-[10px] text-zinc-500 truncate"
                  style={{ minWidth: CELL }}
                >
                  {label?.label ?? ""}
                </div>
              );
            })}
          </div>

          {/* Cells — flex fills full width, aspect-square keeps them square */}
          <div className="flex" style={{ gap: GAP, height: gridHeight }}>
            {weeks.map((week, wi) => (
              <div key={wi} className="flex-1 flex flex-col" style={{ gap: GAP, minWidth: CELL }}>
                {week.map((cell, di) => (
                  <div
                    key={di}
                    className="flex-1 rounded-[3px] transition-colors"
                    style={{
                      backgroundColor: cell === null ? "transparent" : getCellColor(cell.count),
                      cursor: cell && cell.count > 0 ? "default" : undefined,
                    }}
                    title={
                      cell
                        ? `${cell.date} — ${cell.count} completion${cell.count !== 1 ? "s" : ""}`
                        : undefined
                    }
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-5 pt-4 border-t border-zinc-800/40">
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-600">Less</span>
          {[0, 1, 2, 3, 5].map((n) => (
            <div
              key={n}
              className="rounded-[3px]"
              style={{ width: CELL, height: CELL, backgroundColor: getCellColor(n), flexShrink: 0 }}
            />
          ))}
          <span className="text-xs text-zinc-600">More</span>
        </div>

        <p className="text-xs text-zinc-500">
          Total completions:{" "}
          <span className="text-zinc-300 font-semibold">{totalCompletions.toLocaleString()}</span>
        </p>
      </div>
    </div>
  );
}
