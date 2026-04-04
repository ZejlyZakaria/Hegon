"use client";

import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  parseISO,
} from "date-fns";
import { CalendarDayCell } from "./CalendarDayCell";
import type { Task } from "@/modules/tasks/types"

// =====================================================
// CALENDAR GRID
// Monthly view with 7-column grid
// =====================================================

interface CalendarGridProps {
  currentDate: Date;
  tasks: Task[];
  onTaskClick: (task: Task) => void;
}

export function CalendarGrid({
  currentDate,
  tasks,
  onTaskClick,
}: CalendarGridProps) {
  // Get calendar days
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 }); // Sunday
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const days = eachDayOfInterval({
    start: calendarStart,
    end: calendarEnd,
  });

  // Get tasks for a specific day
  const getTasksForDay = (day: Date) => {
    return tasks.filter((task) => {
      if (!task.due_date) return false;
      const taskDate = parseISO(task.due_date);
      return isSameDay(taskDate, day);
    });
  };

  // Day of week headers
  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="flex-1 overflow-x-auto overflow-y-auto px-4 pb-6">
      <div className="min-w-240">
        {/* Week day headers */}
        <div className="grid grid-cols-7 border-b border-white/5 bg-zinc-950 backdrop-blur-sm sticky top-0 z-20">
          {weekDays.map((day) => (
            <div
              key={day}
              className="h-10 flex items-center justify-center text-xs font-medium text-zinc-500"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 auto-rows-[140px]">
          {days.map((day) => {
            const dayTasks = getTasksForDay(day);
            const isCurrentMonth = isSameMonth(day, currentDate);
            const isToday = isSameDay(day, new Date());

            return (
              <CalendarDayCell
                key={day.toISOString()}
                day={day}
                tasks={dayTasks}
                isCurrentMonth={isCurrentMonth}
                isToday={isToday}
                onTaskClick={onTaskClick}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
