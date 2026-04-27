"use client";

import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { useHabits } from "../hooks/useHabits";
import { HABIT_KEYS } from "../hooks/query-keys";
import * as HabitService from "../service";
import { resolveIcon } from "@/shared/constants/icons";
import { cn } from "@/shared/utils/utils";
import { toDateStr, isExpectedOnDate } from "../utils";

const DAYS_HEADER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function capitalizeFirst(s: string): string {
  return s.length > 0 ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

interface CalendarCell {
  day: number | null;
  date: string | null;
  completed: boolean;
  future: boolean;
  today: boolean;
}

export function HabitsCalendarView() {
  const { data: habits = [] } = useHabits();
  const [selectedId, setSelectedId] = useState("");
  const [monthDate, setMonthDate] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );

  const effectiveId = selectedId || habits[0]?.id || "";
  const selectedHabit = habits.find((h) => h.id === effectiveId);
  const habitColor = selectedHabit ? resolveIcon(selectedHabit.icon).color : "#f43f5e";

  const monthStart = toDateStr(new Date(monthDate.getFullYear(), monthDate.getMonth(), 1));
  const monthEnd   = toDateStr(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0));

  const { data: completions = [] } = useQuery({
    queryKey: HABIT_KEYS.completionsRange(effectiveId, monthStart, monthEnd),
    queryFn: () => HabitService.getHabitCompletionsRange(effectiveId, monthStart, monthEnd),
    enabled: !!effectiveId,
    staleTime: 1000 * 60 * 5,
  });

  const completedSet = useMemo(
    () => new Set(completions.map((c) => c.completed_date)),
    [completions]
  );

  const cells = useMemo<CalendarCell[]>(() => {
    const y = monthDate.getFullYear();
    const m = monthDate.getMonth();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const firstDow = new Date(y, m, 1).getDay();
    const startOffset = firstDow === 0 ? 6 : firstDow - 1;
    const todayStr = toDateStr(new Date());

    const result: CalendarCell[] = [];

    for (let i = 0; i < startOffset; i++) {
      result.push({ day: null, date: null, completed: false, future: false, today: false });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const ds = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      result.push({
        day: d,
        date: ds,
        completed: completedSet.has(ds),
        future: ds > todayStr,
        today: ds === todayStr,
      });
    }

    while (result.length % 7 !== 0) {
      result.push({ day: null, date: null, completed: false, future: false, today: false });
    }

    return result;
  }, [monthDate, completedSet]);

  const todayStr = toDateStr(new Date());
  const pastCells = cells.filter((c) => c.date && c.date <= todayStr);
  const completionsMonth = completions.filter(
    (c) => c.completed_date >= monthStart && c.completed_date <= monthEnd
  ).length;
  const expectedCount = selectedHabit
    ? pastCells.filter((c) => c.date && isExpectedOnDate(selectedHabit, c.date)).length
    : pastCells.length;
  const rate = expectedCount > 0 ? Math.round((completionsMonth / expectedCount) * 100) : 0;

  const monthLabel = capitalizeFirst(
    monthDate.toLocaleString("default", { month: "long", year: "numeric" })
  );

  const prevMonth = () => setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const nextMonth = () => setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));

  if (habits.length === 0) {
    return (
      <div
        className="rounded-lg border p-6 text-center"
        style={{
          backgroundColor: "var(--color-surface-1)",
          borderColor: "var(--color-border-subtle)",
        }}
      >
        <p className="text-sm" style={{ color: "var(--color-text-tertiary)" }}>
          No habits yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <Select value={effectiveId} onValueChange={setSelectedId}>
            <SelectTrigger
              variant="tasks"
              className="h-8 w-full bg-[#1f1f22] focus:border-white/20"
            >
              <SelectValue placeholder="Select a habit" />
            </SelectTrigger>
            <SelectContent variant="tasks">
              {habits.map((habit) => (
                <SelectItem key={habit.id} value={habit.id}>
                  {habit.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={prevMonth}
            className="flex h-8 w-8 items-center justify-center rounded-md text-[#71717a] transition-colors duration-100 hover:bg-[#141416] hover:text-[#e2e2e6]"
          >
            <ChevronLeft size={14} />
          </button>

          <span className="w-40 select-none text-center text-sm font-medium text-[#e2e2e6]">
            {monthLabel}
          </span>

          <button
            type="button"
            onClick={nextMonth}
            className="flex h-8 w-8 items-center justify-center rounded-md text-[#71717a] transition-colors duration-100 hover:bg-[#141416] hover:text-[#e2e2e6]"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      <div
        className="overflow-hidden rounded-lg border"
        style={{
          backgroundColor: "var(--color-surface-1)",
          borderColor: "var(--color-border-subtle)",
        }}
      >
        <div
          className="grid grid-cols-7 border-b"
          style={{ borderColor: "var(--color-border-default)" }}
        >
          {DAYS_HEADER.map((d) => (
            <div
              key={d}
              className="py-2 text-center text-xs font-medium"
              style={{ color: "var(--color-text-tertiary)" }}
            >
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {cells.map((cell, i) => (
            <div
              key={i}
              className="relative flex h-12 items-center justify-center"
              style={{
                borderRight: "1px solid rgba(255,255,255,0.04)",
                borderBottom: "1px solid rgba(255,255,255,0.04)",
              }}
            >
              {cell.day && (
                <>
                  {cell.completed && (
                    <div
                      className="absolute inset-1 rounded-md"
                      style={{ backgroundColor: `${habitColor}20` }}
                    />
                  )}

                  {cell.today && (
                    <div
                      className="absolute inset-1 rounded-md"
                      style={{ boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.20)" }}
                    />
                  )}

                  <span
                    className={cn(
                      "relative z-10 text-sm font-medium",
                      cell.future && "opacity-50"
                    )}
                    style={{
                      color: cell.completed
                        ? habitColor
                        : cell.future
                          ? "#71717a"
                          : "#a0a0a8",
                      fontWeight: cell.completed ? 700 : 500,
                    }}
                  >
                    {cell.day}
                  </span>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 px-1 text-xs" style={{ color: "#71717a" }}>
        <span>
          <span style={{ color: "#a0a0a8", fontWeight: 600 }}>{completionsMonth}</span>{" "}
          completions this month
        </span>

        <span style={{ color: "#3d3d44" }}>•</span>

        <span>
          <span style={{ color: "#a0a0a8", fontWeight: 600 }}>{rate}%</span> of past days
        </span>

        {selectedHabit && (
          <>
            <span style={{ color: "#3d3d44" }}>•</span>
            <span>
              Frequency{" "}
              <span
                className="capitalize"
                style={{ color: "#a0a0a8", fontWeight: 600 }}
              >
                {selectedHabit.frequency}
              </span>
            </span>
          </>
        )}
      </div>
    </div>
  );
}
