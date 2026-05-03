"use client";

import { useHabitsToday } from "@/modules/habits/hooks/useHabitsToday";
import { useWeeklyActivity } from "@/modules/dashboard/hooks/useWeeklyActivity";
import { DASH } from "../../constants";

export default function WeeklyActivityWidget() {
  const { recentCompletions, totalCount, isLoading: habitsLoading } = useHabitsToday();

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const from = new Date(today);
  from.setDate(today.getDate() - 6);
  const fromDate = from.toISOString().slice(0, 10);

  const { data: tasksByDay = {}, isLoading: tasksLoading } = useWeeklyActivity(fromDate, todayStr);
  const isLoading = habitsLoading || tasksLoading;

  const habitsByDate = (recentCompletions as { completed_date?: string; date?: string; completed_at?: string; created_at?: string }[]).reduce<Record<string, number>>((acc, c) => {
    const date = (c.completed_date ?? c.date ?? c.completed_at ?? c.created_at ?? "").slice(0, 10);
    if (date) acc[date] = (acc[date] ?? 0) + 1;
    return acc;
  }, {});

  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (6 - i));
    const dateStr = d.toISOString().slice(0, 10);

    const habitsCompleted = habitsByDate[dateStr] ?? 0;
    const habitsScore = totalCount > 0 ? (habitsCompleted / totalCount) * 100 : 0;

    const taskData = tasksByDay[dateStr];
    const taskScore =
      !taskData || taskData.total === 0
        ? null
        : (taskData.completed / taskData.total) * 100;

    const dailyScore =
      taskScore !== null
        ? Math.round((habitsScore + taskScore) / 2)
        : Math.round(habitsScore);

    return {
      dateStr,
      score: dailyScore,
      isToday: dateStr === todayStr,
      label: d.toLocaleDateString("en-US", { weekday: "short" }),
    };
  });

  const avgScore = Math.round(last7.reduce((sum, d) => sum + d.score, 0) / 7);

  return (
    <div className="rounded-xl border border-border-subtle bg-surface-1 p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-zinc-600">This Week</p>
        <span className="text-[10px] text-zinc-500 tabular-nums">
          {isLoading ? "—" : `avg ${avgScore}%`}
        </span>
      </div>

      {/* Chart */}
      <div className="relative h-36 mt-1">
        {/* Y-axis reference lines + labels */}
        {[0, 25, 50, 75, 100].map((pct) => (
          <div
            key={pct}
            className="absolute left-0 right-0 h-0 overflow-visible pointer-events-none"
            style={{ top: `${100 - pct}%` }}
          >
            <span
              className="absolute left-0 w-5 text-[7px] text-zinc-700 tabular-nums leading-none text-center"
              style={{ top: "-0.65rem" }}
            >
              {pct}
            </span>
            <div
              className="absolute left-5 right-0 border-t border-zinc-800/50"
              style={{ borderTopStyle: "dashed" }}
            />
          </div>
        ))}

        {/* Bars */}
        <div className="absolute inset-0 flex items-end gap-2 pl-5">
          {last7.map(({ dateStr, score, isToday }) => {
            const hasData = score > 0;
            return (
              <div key={dateStr} className="flex-1 h-full flex items-end">
                <div
                  className="w-full rounded-t-sm transition-all duration-500"
                  style={{
                    height: isLoading ? "2px" : hasData ? `${Math.max(score, 6)}%` : "2px",
                    background: hasData
                      ? isToday
                        ? `linear-gradient(to bottom, ${DASH}, rgba(96,165,250,0.06))`
                        : `linear-gradient(to bottom, rgba(96,165,250,0.5), rgba(96,165,250,0.03))`
                      : "rgba(255,255,255,0.04)",
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Day labels */}
      <div className="flex gap-2 pl-5">
        {last7.map(({ dateStr, label, isToday }) => (
          <div key={dateStr} className="flex-1 text-center">
            <span
              className="text-[8px]"
              style={{ color: isToday ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.2)" }}
            >
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
