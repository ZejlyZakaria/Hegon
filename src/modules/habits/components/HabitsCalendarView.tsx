"use client";

import { Fragment, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { useHabits } from "../hooks/useHabits";
import { HABIT_KEYS } from "../hooks/query-keys";
import * as HabitService from "../service";
import { resolveIcon } from "@/shared/constants/icons";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";
import { cn } from "@/shared/utils/utils";
import { toast } from "@/shared/utils/toast";
import { toDateStr, isExpectedOnDate, getTodayStr } from "../utils";

const ACCENT = "var(--color-accent-habits-vivid)";
const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function weekStartMonday(d: Date): Date {
  const x = new Date(d);
  const dow = x.getDay();
  x.setDate(x.getDate() - (dow === 0 ? 6 : dow - 1));
  x.setHours(0, 0, 0, 0);
  return x;
}

export function HabitsCalendarView() {
  const { data: habits = [] } = useHabits();
  const qc = useQueryClient();
  const [anchor, setAnchor] = useState(() => weekStartMonday(new Date()));

  const weekDates = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date(anchor);
        d.setDate(anchor.getDate() + i);
        return toDateStr(d);
      }),
    [anchor],
  );
  const weekStart = weekDates[0];
  const weekEnd = weekDates[6];
  const todayStr = getTodayStr();

  const habitIds = habits.map((h) => h.id);

  const { data: comps = [] } = useQuery({
    queryKey: HABIT_KEYS.completionsRange("week", weekStart, weekEnd),
    queryFn: () => HabitService.getCompletionsForHabits(habitIds, weekStart, weekEnd),
    enabled: habitIds.length > 0,
    staleTime: 1000 * 60 * 5,
  });

  const doneSet = useMemo(
    () => new Set(comps.map((c) => `${c.habit_id}|${c.completed_date}`)),
    [comps],
  );

  const toggle = useMutation({
    mutationFn: async ({ habitId, date, done }: { habitId: string; date: string; done: boolean }) => {
      if (done) await HabitService.uncompleteHabit(habitId, date);
      else await HabitService.completeHabit({ habit_id: habitId, completed_date: date });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: HABIT_KEYS.all }),
    onError: () => toast.error("Failed to update completion."),
  });

  // Per-day completion rate (over habits expected that day, past + today only).
  const dayPct = (ds: string): number | null => {
    if (ds > todayStr) return null;
    const expected = habits.filter((h) => isExpectedOnDate(h, ds));
    if (expected.length === 0) return null;
    const done = expected.filter((h) => doneSet.has(`${h.id}|${ds}`)).length;
    return Math.round((done / expected.length) * 100);
  };

  // Per-habit weekly rate (footer average).
  const habitPct = (habitId: string): number | null => {
    const h = habits.find((x) => x.id === habitId);
    if (!h) return null;
    const days = weekDates.filter((ds) => ds <= todayStr && isExpectedOnDate(h, ds));
    if (days.length === 0) return null;
    const done = days.filter((ds) => doneSet.has(`${habitId}|${ds}`)).length;
    return Math.round((done / days.length) * 100);
  };

  const weekLabel = `${new Date(weekStart + "T12:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })} – ${new Date(weekEnd + "T12:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })}`;

  const isThisWeek = weekStart === toDateStr(weekStartMonday(new Date()));

  if (habits.length === 0) {
    return (
      <div className="rounded-lg border border-border-subtle bg-surface-1 p-6 text-center">
        <p className="text-sm text-text-tertiary">No habits yet.</p>
      </div>
    );
  }

  const gridCols = `132px repeat(${habits.length}, minmax(44px, 1fr)) 52px`;

  return (
    <div className="space-y-3">
      {/* Week nav */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setAnchor((d) => { const n = new Date(d); n.setDate(d.getDate() - 7); return n; })}
            className="flex h-8 w-8 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-surface-2 hover:text-text-primary active:scale-95"
            aria-label="Previous week"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="w-36 select-none text-center text-sm font-medium text-text-primary">
            {weekLabel}
          </span>
          <button
            type="button"
            onClick={() => setAnchor((d) => { const n = new Date(d); n.setDate(d.getDate() + 7); return n; })}
            className="flex h-8 w-8 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-surface-2 hover:text-text-primary active:scale-95"
            aria-label="Next week"
          >
            <ChevronRight size={14} />
          </button>
        </div>
        {!isThisWeek && (
          <button
            type="button"
            onClick={() => setAnchor(weekStartMonday(new Date()))}
            className="text-xs font-medium text-text-tertiary transition-colors hover:text-text-primary"
          >
            This week
          </button>
        )}
      </div>

      {/* Grid */}
      <div className="overflow-x-auto rounded-lg border border-border-subtle bg-surface-1 custom-scrollbar">
        <div className="grid" style={{ gridTemplateColumns: gridCols, minWidth: 132 + habits.length * 44 + 52 }}>
          {/* Header */}
          <div className="border-b border-border-default px-3 py-2.5" />
          {habits.map((h) => {
            const { icon: Icon, color } = resolveIcon(h.icon);
            return (
              <div
                key={`head-${h.id}`}
                className="flex items-center justify-center border-b border-l border-border-subtle py-2.5"
                title={h.title}
              >
                <div
                  className="flex h-7 w-7 items-center justify-center rounded-md border border-border-subtle bg-surface-2"
                  style={{ color }}
                >
                  <Icon size={14} />
                </div>
              </div>
            );
          })}
          <div className="flex items-center justify-center border-b border-l border-border-subtle py-2.5 text-caption uppercase text-text-tertiary">
            %
          </div>

          {/* Day rows */}
          {weekDates.map((ds, ri) => {
            const dayNum = new Date(ds + "T12:00:00").getDate();
            const isToday = ds === todayStr;
            const pct = dayPct(ds);
            return (
              <Fragment key={`row-${ds}`}>
                <div
                  className={cn(
                    "flex items-center gap-2 border-b border-border-subtle px-3 py-2",
                    isToday && "bg-surface-2/40",
                  )}
                >
                  <span className="text-xs font-medium text-text-tertiary">{DOW[ri]}</span>
                  <span
                    className={cn(
                      "text-sm font-semibold",
                      isToday ? "text-text-primary" : "text-text-secondary",
                    )}
                  >
                    {dayNum}
                  </span>
                  {isToday && (
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: ACCENT }}
                    />
                  )}
                </div>

                {habits.map((h) => {
                  const expected = isExpectedOnDate(h, ds);
                  const done = doneSet.has(`${h.id}|${ds}`);
                  const future = ds > todayStr;
                  const dateLabel = new Date(ds + "T12:00:00").toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  });
                  const statusLabel = !expected
                    ? "Not scheduled"
                    : done
                      ? "Done"
                      : future
                        ? "Upcoming"
                        : "Not done";
                  return (
                    <div
                      key={`cell-${h.id}-${ds}`}
                      className={cn(
                        "flex items-center justify-center border-b border-l border-border-subtle py-2",
                        isToday && "bg-surface-2/40",
                      )}
                    >
                      <Tooltip>
                        <TooltipTrigger asChild>
                          {!expected ? (
                            <span className="cursor-default text-text-disabled">·</span>
                          ) : (
                            <button
                              type="button"
                              disabled={future || toggle.isPending}
                              onClick={() => toggle.mutate({ habitId: h.id, date: ds, done })}
                              aria-label={`${h.title} — ${dateLabel} — ${statusLabel}`}
                              className={cn(
                                "flex h-6 w-6 items-center justify-center rounded-md border transition-[background-color,border-color,transform] duration-150 ease-out",
                                done
                                  ? "border-transparent text-white active:scale-90"
                                  : future
                                    ? "cursor-default border-border-subtle"
                                    : "border-border-strong hover:border-text-tertiary active:scale-90",
                              )}
                              style={done ? { backgroundColor: ACCENT } : undefined}
                            >
                              {done && <Check size={13} strokeWidth={3} />}
                            </button>
                          )}
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          <span className="font-semibold text-text-primary">{h.title}</span>
                          <br />
                          {dateLabel} · {statusLabel}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  );
                })}

                <div
                  className={cn(
                    "flex items-center justify-center border-b border-l border-border-subtle text-xs font-medium",
                    isToday && "bg-surface-2/40",
                  )}
                  style={{ color: pct === null ? "var(--color-text-disabled)" : pct === 100 ? ACCENT : "var(--color-text-tertiary)" }}
                >
                  {pct === null ? "—" : `${pct}%`}
                </div>
              </Fragment>
            );
          })}

          {/* Average row */}
          <div className="flex items-center px-3 py-2.5 text-caption uppercase text-text-tertiary">
            Average
          </div>
          {habits.map((h) => {
            const pct = habitPct(h.id);
            return (
              <div
                key={`avg-${h.id}`}
                className="flex items-center justify-center border-l border-border-subtle py-2.5 text-xs font-semibold"
                style={{ color: pct === null ? "var(--color-text-disabled)" : pct >= 80 ? ACCENT : "var(--color-text-secondary)" }}
              >
                {pct === null ? "—" : `${pct}%`}
              </div>
            );
          })}
          <div className="border-l border-border-subtle" />
        </div>
      </div>

      <p className="px-1 text-[11px] text-text-tertiary">
        Tap any cell to mark a day done. Past days can be edited; future days are locked.
      </p>
    </div>
  );
}
