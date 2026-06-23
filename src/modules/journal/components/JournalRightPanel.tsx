"use client";

import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, Flame, History } from "lucide-react";
import { useJournalStreak, useJournalCalendar, useOnThisDay } from "../hooks/useJournalCalendar";
import { useEventsForMonth } from "../hooks/useJournalEvents";
import { toDateStr, getCurrentWeekDays, getMonthGrid, getPreview } from "../lib/journal-utils";
import { MOOD_CONFIG } from "../types";
import type { JournalMood } from "../types";
import { JournalEvents } from "./JournalEvents";

const ACCENT = "var(--color-accent-journal-vivid)";
const DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export function JournalRightPanel() {
  const today = new Date();
  const todayStr = toDateStr(today);
  const [currentMonth, setCurrentMonth] = useState(today.getMonth() + 1);
  const [currentYear, setCurrentYear] = useState(today.getFullYear());

  const { data: streak } = useJournalStreak();
  const { data: onThisDay = [] } = useOnThisDay();
  const { data: calendarData } = useJournalCalendar(currentYear, currentMonth);
  const { data: monthEvents = [] } = useEventsForMonth(currentYear, currentMonth);
  const eventDates = useMemo(
    () => new Set(monthEvents.map((e) => e.event_date)),
    [monthEvents],
  );
  // Separate query for streak week — always today's real month
  const { data: streakCalendarData } = useJournalCalendar(
    today.getFullYear(),
    today.getMonth() + 1
  );

  // Mood map for calendar navigation
  const moodMap = new Map<string, JournalMood | null>();
  calendarData?.forEach((day) => moodMap.set(day.entry_date, day.mood));

  // Mood map for streak week
  const streakMoodMap = new Map<string, JournalMood | null>();
  streakCalendarData?.forEach((day) => streakMoodMap.set(day.entry_date, day.mood));

  // Current week Mon → Sun — computed once on mount, never changes
  const [weekDays] = useState(() => getCurrentWeekDays(new Date()));

  // Calendar grid — recompute only when month/year changes
  const { daysInMonth, startDayOfWeek } = useMemo(
    () => getMonthGrid(currentYear, currentMonth),
    [currentYear, currentMonth]
  );

  const goToPrevMonth = () => {
    if (currentMonth === 1) { setCurrentMonth(12); setCurrentYear(currentYear - 1); }
    else setCurrentMonth(currentMonth - 1);
  };

  const goToNextMonth = () => {
    if (currentMonth === 12) { setCurrentMonth(1); setCurrentYear(currentYear + 1); }
    else setCurrentMonth(currentMonth + 1);
  };

  return (
    <div className="w-full flex flex-col gap-3">
      {/* ── Streak — branded hero (deep-accent solid surface, like Habits/Books) ── */}
      <div
        className="relative overflow-hidden rounded-card p-4 flex flex-col gap-3"
        style={{
          background: "var(--color-accent-journal)",
          boxShadow:
            "inset 0 1px 0 0 rgba(255,255,255,0.08), inset 0 0 0 1px rgba(255,255,255,0.06), 0 1px 2px 0 rgba(0,0,0,0.35), 0 10px 30px -12px rgba(0,0,0,0.5)",
        }}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-white/90">Streak</h3>
          <span className="inline-flex items-center gap-1 text-xs text-white/55">
            <Flame size={11} style={{ color: "var(--color-fire)" }} />
            Best {streak?.best ?? 0}
          </span>
        </div>

        <div className="flex items-baseline gap-1.5">
          <span className="text-3xl font-bold text-white">{streak?.current ?? 0}</span>
          <span className="text-sm text-white/70">days</span>
        </div>

        <div className="flex items-center justify-between">
          {DAYS.map((day, i) => {
            const d = weekDays[i];
            const dateStr = toDateStr(d);
            const isFuture = dateStr > todayStr;
            const hasEntry = streakMoodMap.get(dateStr) !== undefined;
            const active = !isFuture && hasEntry;

            return (
              <div key={i} className="flex flex-col items-center gap-1">
                <span className="text-[10px] text-white/45">{day}</span>
                <div
                  className="w-2 h-2 rounded-full"
                  style={{
                    backgroundColor: active ? ACCENT : "rgba(255,255,255,0.15)",
                    boxShadow: active ? `0 0 6px ${ACCENT}` : undefined,
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* ── On this day — memories from past years ── */}
      {onThisDay.length > 0 && (
        <div className="surface-card rounded-card p-4 flex flex-col gap-3">
          <div className="flex items-center gap-1.5">
            <History size={13} className="text-text-tertiary" />
            <h3 className="text-xs font-semibold text-text-secondary">On this day</h3>
          </div>
          <div className="flex flex-col gap-2.5">
            {onThisDay.map((e) => (
              <div key={e.id} className="flex flex-col gap-0.5">
                <span className="text-[11px] font-medium" style={{ color: ACCENT }}>
                  {e.entry_date.slice(0, 4)}
                </span>
                <p className="line-clamp-2 text-xs text-text-secondary">
                  {getPreview(e.content) || "—"}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Calendar ── */}
      <div className="surface-card rounded-card p-4 flex flex-col gap-3">
        {/* Month header — title left, chevrons right */}
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-text-secondary">
            {MONTHS[currentMonth - 1]} {currentYear}
          </h3>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={goToPrevMonth}
              className="p-1 hover:bg-surface-2 rounded-control transition-colors"
            >
              <ChevronLeft className="w-4 h-4 text-text-secondary" />
            </button>
            <button
              type="button"
              onClick={goToNextMonth}
              className="p-1 hover:bg-surface-2 rounded-control transition-colors"
            >
              <ChevronRight className="w-4 h-4 text-text-secondary" />
            </button>
          </div>
        </div>

        {/* Day labels */}
        <div className="grid grid-cols-7 gap-1">
          {DAYS.map((day, i) => (
            <div key={i} className="text-[10px] text-text-tertiary text-center h-6 flex items-center justify-center">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: startDayOfWeek }).map((_, i) => (
            <div key={`empty-${i}`} className="h-8" />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const mood = moodMap.get(dateStr);
            const hasEntry = mood !== undefined;

            let dotColor = 'var(--color-surface-3)';
            if (hasEntry && mood) dotColor = MOOD_CONFIG[mood].color;
            else if (hasEntry) dotColor = 'var(--color-text-tertiary)';

            const hasEvent = eventDates.has(dateStr);

            return (
              <div key={day} className="h-8 flex flex-col items-center justify-center gap-0.5">
                <span
                  className="text-[10px] leading-none"
                  style={{ color: hasEvent ? ACCENT : 'var(--color-text-tertiary)', fontWeight: hasEvent ? 600 : 400 }}
                >
                  {day}
                </span>
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: dotColor }} />
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Events — important dates / reminders ── */}
      <JournalEvents />
    </div>
  );
}
