"use client";

import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/shared/components/ui/select";
import { cn } from "@/shared/utils/utils";
import { daysInMonth, type WatchDateParts } from "../../lib/watched-date";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * "When did you watch it?" — year required, month and day optional, day count adapting to the month
 * (and to February in a leap year). ONE picker, used both when adding a title and when correcting
 * the date on its detail page, so the two can never drift apart again.
 *
 * The bounds tell the truth: you cannot have watched something before it released (the `minYear` /
 * `minMonth` floor) nor after today (a future month or day is never offered). Clearing the month
 * clears the day with it — a day without a month means nothing.
 */
export interface WatchDatePickerProps {
  value: WatchDateParts;
  onChange: (v: WatchDateParts) => void;
  /** Earliest year you could have watched it — its release year. */
  minYear: number;
  /** Earliest month, applied only in `minYear` itself (the release month). */
  minMonth?: number;
  className?: string;
  triggerClassName?: string;
}

const range = (from: number, to: number) =>
  from > to ? [] : Array.from({ length: to - from + 1 }, (_, i) => from + i);

export function WatchDatePicker({
  value, onChange, minYear, minMonth = 1, className, triggerClassName,
}: WatchDatePickerProps) {
  const now = new Date();
  const nowYear = now.getFullYear();
  const nowMonth = now.getMonth() + 1;
  const nowDay = now.getDate();

  const { year, month, day } = value;

  const years = range(Math.min(minYear, nowYear), nowYear).reverse();

  // A month is bounded below by the release month (only in the release year) and above by the
  // current month (only in the current year).
  const monthMin = year === minYear ? minMonth : 1;
  const monthMax = year === nowYear ? nowMonth : 12;
  const months = range(monthMin, monthMax);

  // A day is bounded above by the length of the month — and by today, in the current month.
  const dayMax =
    month == null
      ? 0
      : year === nowYear && month === nowMonth
        ? nowDay
        : daysInMonth(year, month);
  const days = range(1, dayMax);

  const trigger = cn("h-9 border-border-subtle bg-surface-overlay text-xs text-text-secondary focus:ring-0", triggerClassName);
  const content = "border-border-strong bg-surface-3";
  const item = "text-xs focus:bg-surface-2 focus:text-text-primary";

  const setYear = (y: number) => {
    // Re-floor month/day to the new year's bounds; drop them if they fall out.
    let m = month;
    if (m != null) {
      const lo = y === minYear ? minMonth : 1;
      const hi = y === nowYear ? nowMonth : 12;
      if (m < lo || m > hi) m = null;
    }
    const d = m == null ? null : clampDay(y, m, day);
    onChange({ year: y, month: m, day: d });
  };

  const setMonth = (m: number | null) => {
    onChange({ year, month: m, day: m == null ? null : clampDay(year, m, day) });
  };

  const clampDay = (y: number, m: number, d: number | null): number | null => {
    if (d == null) return null;
    const hi = y === nowYear && m === nowMonth ? nowDay : daysInMonth(y, m);
    return d > hi ? null : d;
  };

  return (
    <div className={cn("flex gap-2", className)}>
      {/* Month — optional */}
      <Select value={month != null ? String(month) : "none"} onValueChange={(v) => setMonth(v === "none" ? null : Number(v))}>
        <SelectTrigger variant="legacy" className={cn(trigger, "flex-1")}><SelectValue /></SelectTrigger>
        <SelectContent variant="legacy" className={content}>
          <SelectItem value="none" className={item}>Month</SelectItem>
          {months.map((m) => <SelectItem key={m} value={String(m)} className={item}>{MONTHS[m - 1]}</SelectItem>)}
        </SelectContent>
      </Select>

      {/* Day — optional, disabled until a month is chosen */}
      <Select value={day != null ? String(day) : "none"} onValueChange={(v) => onChange({ year, month, day: v === "none" ? null : Number(v) })} disabled={month == null}>
        <SelectTrigger variant="legacy" className={cn(trigger, "w-20", month == null && "opacity-40")}><SelectValue placeholder="Day" /></SelectTrigger>
        <SelectContent variant="legacy" className={content}>
          <SelectItem value="none" className={item}>Day</SelectItem>
          {days.map((d) => <SelectItem key={d} value={String(d)} className={item}>{d}</SelectItem>)}
        </SelectContent>
      </Select>

      {/* Year — required */}
      <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
        <SelectTrigger variant="legacy" className={cn(trigger, "w-24")}><SelectValue /></SelectTrigger>
        <SelectContent variant="legacy" className={content}>
          {years.map((y) => <SelectItem key={y} value={String(y)} className={item}>{y}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}
