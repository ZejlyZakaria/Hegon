"use client";

import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useHabits } from "../hooks/useHabits";
import { HABIT_KEYS } from "../hooks/query-keys";
import * as HabitService from "../service";
import { resolveIcon } from "@/shared/constants/icons";
import { cn } from "@/shared/utils/utils";

const DAYS_HEADER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface CalendarCell {
  day:       number | null;
  date:      string | null;
  completed: boolean;
  future:    boolean;
  today:     boolean;
}

export function HabitsCalendarView() {
  const { data: habits = [] } = useHabits();
  const [selectedId, setSelectedId] = useState("");
  const [monthDate, setMonthDate]   = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );

  const effectiveId    = selectedId || habits[0]?.id || "";
  const selectedHabit  = habits.find((h) => h.id === effectiveId);
  const habitColor     = selectedHabit ? resolveIcon(selectedHabit.icon).color : "#f43f5e";

  // Month range
  const year       = monthDate.getFullYear();
  const month      = monthDate.getMonth();
  const monthStart = toDateStr(new Date(year, month, 1));
  const monthEnd   = toDateStr(new Date(year, month + 1, 0));

  const { data: completions = [] } = useQuery({
    queryKey: HABIT_KEYS.completionsRange(effectiveId, monthStart, monthEnd),
    queryFn:  () => HabitService.getHabitCompletionsRange(effectiveId, monthStart, monthEnd),
    enabled:  !!effectiveId,
    staleTime: 1000 * 60 * 5,
  });

  const completedSet = useMemo(
    () => new Set(completions.map((c) => c.completed_date)),
    [completions]
  );

  // Build calendar grid (Mon-first)
  const cells = useMemo<CalendarCell[]>(() => {
    const daysInMonth  = new Date(year, month + 1, 0).getDate();
    const firstDow     = new Date(year, month, 1).getDay(); // 0=Sun
    const startOffset  = firstDow === 0 ? 6 : firstDow - 1; // convert to Mon-first
    const todayStr     = toDateStr(new Date());

    const result: CalendarCell[] = [];
    for (let i = 0; i < startOffset; i++) {
      result.push({ day: null, date: null, completed: false, future: false, today: false });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      result.push({
        day:       d,
        date:      ds,
        completed: completedSet.has(ds),
        future:    ds > todayStr,
        today:     ds === todayStr,
      });
    }
    return result;
  }, [year, month, completedSet]);

  // Stats
  const todayStr         = toDateStr(new Date());
  const pastCells        = cells.filter((c) => c.date && c.date <= todayStr);
  const completionsMonth = completions.filter((c) => c.completed_date >= monthStart && c.completed_date <= monthEnd).length;
  const rate             = pastCells.length > 0 ? Math.round((completionsMonth / pastCells.length) * 100) : 0;

  const monthLabel = monthDate.toLocaleString("default", { month: "long", year: "numeric" });

  const prevMonth = () => setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const nextMonth = () => setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));

  if (habits.length === 0) {
    return <p className="text-sm text-zinc-600 text-center py-8">No habits yet.</p>;
  }

  return (
    <div className="space-y-4">

      {/* Controls */}
      <div className="flex items-center gap-3">
        {/* Habit selector */}
        <select
          value={effectiveId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="flex-1 h-9 px-3 rounded-lg bg-zinc-900/60 border border-zinc-800/60 text-sm text-zinc-200 outline-none focus:ring-1 focus:ring-[#f43f5e]/50 transition-all"
        >
          {habits.map((h) => (
            <option key={h.id} value={h.id} className="bg-zinc-900">
              {h.title}
            </option>
          ))}
        </select>

        {/* Month navigation */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={prevMonth}
            className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <ChevronLeft size={15} />
          </button>
          <span className="text-sm font-medium text-zinc-300 w-38 text-center select-none">
            {monthLabel}
          </span>
          <button
            onClick={nextMonth}
            className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/60 overflow-hidden">

        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-zinc-800/60">
          {DAYS_HEADER.map((d) => (
            <div key={d} className="py-2 text-center text-xs font-medium text-zinc-600">
              {d}
            </div>
          ))}
        </div>

        {/* Cells */}
        <div className="grid grid-cols-7">
          {cells.map((cell, i) => (
            <div
              key={i}
              className={cn(
                "relative h-12 flex items-center justify-center border-b border-r border-zinc-800/20",
                "transition-colors",
                !cell.day && "bg-transparent",
              )}
            >
              {cell.day && (
                <>
                  {/* Background fill for completed */}
                  {cell.completed && (
                    <div
                      className="absolute inset-[3px] rounded-lg"
                      style={{ backgroundColor: `${habitColor}25` }}
                    />
                  )}
                  {/* Today ring */}
                  {cell.today && (
                    <div className="absolute inset-[3px] rounded-lg ring-1 ring-zinc-600/60" />
                  )}
                  {/* Day number */}
                  <span
                    className={cn(
                      "relative z-10 text-sm font-medium",
                      cell.completed ? "font-bold" : "",
                      cell.future    ? "text-zinc-700"
                      : cell.completed ? ""
                      : "text-zinc-400",
                    )}
                    style={cell.completed ? { color: habitColor } : undefined}
                  >
                    {cell.day}
                  </span>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-3 text-xs text-zinc-500 px-1">
        <span>
          <span className="text-zinc-300 font-semibold">{completionsMonth}</span>{" "}
          completions this month
        </span>
        <span className="text-zinc-700">•</span>
        <span>
          <span className="text-zinc-300 font-semibold">{rate}%</span> of past days
        </span>
        {selectedHabit && (
          <>
            <span className="text-zinc-700">•</span>
            <span>
              Frequency:{" "}
              <span className="text-zinc-300 font-semibold capitalize">{selectedHabit.frequency}</span>
            </span>
          </>
        )}
      </div>
    </div>
  );
}
