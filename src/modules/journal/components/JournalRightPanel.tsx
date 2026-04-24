"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useJournalStreak, useJournalCalendar } from "../hooks/useJournalCalendar";
import { toDateStr, getCurrentWeekDays, getMonthGrid } from "../lib/journal-utils";
import { MOOD_CONFIG } from "../types";
import type { JournalMood } from "../types";

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
  const { data: calendarData } = useJournalCalendar(currentYear, currentMonth);
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

  // Current week Mon → Sun
  const weekDays = getCurrentWeekDays(today);

  // Calendar grid
  const { daysInMonth, startDayOfWeek } = getMonthGrid(currentYear, currentMonth);

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
      {/* ── Streak ── */}
      <div className="bg-surface-1 rounded-lg p-4 flex flex-col gap-3">
        {/* Title row */}
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-text-secondary">Streak</h3>
          <span className="text-xs text-text-tertiary">Best {streak?.best ?? 0}</span>
        </div>

        {/* Count */}
        <div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-bold text-text-primary">{streak?.current ?? 0}</span>
            <span className="text-sm text-text-tertiary">days</span>
          </div>
          <p className="text-xs text-text-tertiary mt-0.5">Keep it up!</p>
        </div>

        {/* Week dots */}
        <div className="flex items-center justify-between">
          {DAYS.map((day, i) => {
            const d = weekDays[i];
            const dateStr = toDateStr(d);
            const isFuture = dateStr > todayStr;
            const mood = streakMoodMap.get(dateStr);
            const hasEntry = mood !== undefined;

            let dotColor = '#27272a';
            if (!isFuture && hasEntry) dotColor = '#f97316';

            return (
              <div key={i} className="flex flex-col items-center gap-1">
                <span className="text-[10px] text-text-tertiary">{day}</span>
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: dotColor }} />
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Calendar ── */}
      <div className="bg-surface-1 rounded-lg p-4 flex flex-col gap-3">
        {/* Month header — title left, chevrons right */}
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-text-secondary">
            {MONTHS[currentMonth - 1]} {currentYear}
          </h3>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={goToPrevMonth}
              className="p-1 hover:bg-surface-2 rounded transition-colors"
            >
              <ChevronLeft className="w-4 h-4 text-text-secondary" />
            </button>
            <button
              type="button"
              onClick={goToNextMonth}
              className="p-1 hover:bg-surface-2 rounded transition-colors"
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

            let dotColor = '#27272a';
            if (hasEntry && mood) dotColor = MOOD_CONFIG[mood].color;
            else if (hasEntry) dotColor = '#52525b';

            return (
              <div key={day} className="h-8 flex flex-col items-center justify-center gap-0.5">
                <span className="text-[10px] text-text-tertiary leading-none">{day}</span>
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: dotColor }} />
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Mood legend ── */}
      <div className="bg-surface-1 rounded-lg p-4 flex flex-col gap-2">
        <h3 className="text-xs font-semibold text-text-secondary mb-0">Mood</h3>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(MOOD_CONFIG).map(([mood, config]) => (
            <div key={mood} className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: config.color }} />
              <span className="text-xs text-text-secondary">{config.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
