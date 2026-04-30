"use client";

import { useMemo, useState } from "react";
import { cn } from "@/shared/utils/utils";
import { useHeatmapData } from "../hooks/useHabitStats";
import { AllHabitsHeatmapSkeleton } from "./HabitsSkeleton";
import { toDateStr } from "../utils";
import type { HeatmapDay } from "../types";

type RangeMode = "6M" | "12M";
type GridCell = { date: string; count: number } | null;
type MonthLabel = { col: number; label: string };

const ACCENT = "var(--color-accent-habits)";
const CELL = 16;
const GAP = 3;
const ROWS = 7;
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function getCellColor(count: number): string {
  if (count === 0) return "var(--color-surface-2)";
  if (count === 1) return "#4c0d1f";
  if (count === 2) return "#881337";
  if (count <= 4) return "#be123c";
  return ACCENT;
}

function buildGrid(data: HeatmapDay[], monthsBack: number) {
  const today = new Date();
  const todayStr = toDateStr(today);
  const countMap = new Map(data.map((d) => [d.date, d.count]));

  const start = new Date(today);
  start.setMonth(start.getMonth() - monthsBack);
  while (start.getDay() !== 1) start.setDate(start.getDate() - 1);

  const weeks: GridCell[][] = [];
  const cur = new Date(start);

  while (toDateStr(cur) <= todayStr) {
    const week: GridCell[] = [];
    for (let d = 0; d < ROWS; d++) {
      const ds = toDateStr(cur);
      week.push(ds > todayStr ? null : { date: ds, count: countMap.get(ds) ?? 0 });
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

export function AllHabitsHeatmap() {
  const [range, setRange] = useState<RangeMode>("6M");
  const { data, isLoading } = useHeatmapData();

  const { weeks, totalCompletions, monthLabels, gridWidth, gridHeight } = useMemo(() => {
    const monthsBack = range === "6M" ? 6 : 12;
    const weeks = buildGrid(data, monthsBack);
    const totalCompletions = data.reduce((sum, day) => sum + day.count, 0);
    const monthLabels = buildMonthLabels(weeks);
    const gridWidth = weeks.length * CELL + Math.max(weeks.length - 1, 0) * GAP;
    const gridHeight = ROWS * CELL + Math.max(ROWS - 1, 0) * GAP;

    return { weeks, totalCompletions, monthLabels, gridWidth, gridHeight };
  }, [data, range]);

  if (isLoading) {
    return <AllHabitsHeatmapSkeleton />;
  }

  if (data.length === 0) {
    return (
      <div
        className="rounded-lg border p-6 text-center"
        style={{
          backgroundColor: "var(--color-surface-1)",
          borderColor: "var(--color-border-subtle)",
        }}
      >
        <p className="text-sm" style={{ color: "var(--color-text-tertiary)" }}>
          No data yet.
        </p>
      </div>
    );
  }

  return (
    <div
      className="rounded-lg border p-4"
      style={{
        backgroundColor: "var(--color-surface-1)",
        borderColor: "var(--color-border-subtle)",
      }}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <p
          className="text-sm font-semibold"
          style={{ color: "var(--color-text-primary)" }}
        >
          All Habits Heatmap
        </p>

        <div className="flex items-center gap-3">
          <div
            className="flex rounded-md border overflow-hidden"
            style={{ borderColor: "var(--color-border-default)" }}
          >
            {(["6M", "12M"] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setRange(item)}
                className={cn(
                  "px-2.5 py-1 text-[10px] font-medium transition-colors duration-100",
                  range === item
                    ? "text-white"
                    : "text-[#71717a] hover:text-[#a0a0a8]"
                )}
                style={{
                  backgroundColor: range === item ? ACCENT : "transparent",
                }}
              >
                {item}
              </button>
            ))}
          </div>

          <span
            className="text-xs"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            Last {range === "6M" ? "6 months" : "12 months"}
          </span>
        </div>
      </div>

      <div className="overflow-x-auto custom-scrollbar">
        <div className="flex gap-3" style={{ minWidth: 26 + 12 + gridWidth }}>
          <div className="mt-5 flex shrink-0 flex-col" style={{ gap: GAP }}>
            {DAY_LABELS.map((label) => (
              <div
                key={label}
                className="flex items-center justify-end text-[10px] leading-none"
                style={{
                  height: CELL,
                  width: 26,
                  color: "var(--color-text-tertiary)",
                }}
              >
                {label}
              </div>
            ))}
          </div>

          <div className="shrink-0" style={{ width: gridWidth }}>
            <div className="relative mb-1" style={{ width: gridWidth, height: 16 }}>
              {monthLabels.map((month) => (
                <div
                  key={`${month.col}-${month.label}`}
                  className="absolute text-[10px] leading-none"
                  style={{
                    left: month.col * (CELL + GAP),
                    color: "var(--color-text-tertiary)",
                  }}
                >
                  {month.label}
                </div>
              ))}
            </div>

            <div className="flex" style={{ gap: GAP, width: gridWidth, height: gridHeight }}>
              {weeks.map((week, wi) => (
                <div
                  key={wi}
                  className="flex shrink-0 flex-col"
                  style={{ gap: GAP, width: CELL }}
                >
                  {week.map((cell, di) => (
                    <div
                      key={di}
                      className="rounded-[3px] transition-colors duration-100"
                      style={{
                        width: CELL,
                        height: CELL,
                        backgroundColor: cell === null ? "transparent" : getCellColor(cell.count),
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
      </div>

      <div className="mt-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span
            className="text-xs"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            Less
          </span>

          {[0, 1, 2, 3, 5].map((n) => (
            <div
              key={n}
              className="rounded-[3px]"
              style={{
                width: CELL,
                height: CELL,
                backgroundColor: getCellColor(n),
              }}
            />
          ))}

          <span
            className="text-xs"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            More
          </span>
        </div>

        <span
          className="text-xs"
          style={{ color: "var(--color-text-tertiary)" }}
        >
          <span
            className="font-semibold"
            style={{ color: "var(--color-text-secondary)" }}
          >
            {totalCompletions.toLocaleString()}
          </span>{" "}
          total
        </span>
      </div>
    </div>
  );
}
