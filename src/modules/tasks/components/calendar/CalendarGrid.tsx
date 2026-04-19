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
import type { Task } from "@/modules/tasks/types";

interface CalendarGridProps {
  currentDate: Date;
  tasks: Task[];
  onTaskClick: (task: Task) => void;
}

const WEEK_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function CalendarGrid({
  currentDate,
  tasks,
  onTaskClick,
}: CalendarGridProps) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const days = eachDayOfInterval({
    start: calendarStart,
    end: calendarEnd,
  });

  const getTasksForDay = (day: Date) => {
    return tasks.filter((task) => {
      if (!task.due_date) return false;
      const taskDate = parseISO(task.due_date);
      return isSameDay(taskDate, day);
    });
  };

  return (
    <div className="flex-1 overflow-auto px-4 pb-4">
      <div className="min-w-280">
        <div
          className="sticky top-0 z-10 grid grid-cols-7 border-b"
          style={{
            backgroundColor: "var(--color-surface-0)",
            borderColor: "var(--color-border-subtle)",
          }}
        >
          {WEEK_DAYS.map((day) => (
            <div
              key={day}
              className="flex h-10 items-center justify-center text-xs font-medium"
              style={{ color: "var(--color-text-tertiary)" }}
            >
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {days.map((day) => (
            <CalendarDayCell
              key={day.toISOString()}
              day={day}
              tasks={getTasksForDay(day)}
              isCurrentMonth={isSameMonth(day, currentDate)}
              isToday={isSameDay(day, new Date())}
              onTaskClick={onTaskClick}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
