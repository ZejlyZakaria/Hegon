"use client";

import { addMonths, format, subMonths } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/shared/components/ui/button";

interface CalendarHeaderProps {
  currentDate: Date;
  taskCount: number;
  onDateChange: (date: Date) => void;
}

export function CalendarHeader({
  currentDate,
  taskCount,
  onDateChange,
}: CalendarHeaderProps) {
  return (
    <div
      className="flex items-center justify-between px-4 pb-4 pt-1"
      style={{ borderColor: "var(--color-border-subtle)" }}
    >
      <div className="flex items-center gap-3">
        <h2
          className="min-w-45 text-xl font-semibold leading-tight"
          style={{ color: "var(--color-text-primary)" }}
        >
          {format(currentDate, "MMMM yyyy")}
        </h2>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDateChange(subMonths(currentDate, 1))}
            className="h-8 w-8 rounded-md p-0"
          >
            <ChevronLeft size={14} />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDateChange(addMonths(currentDate, 1))}
            className="h-8 w-8 rounded-md p-0"
          >
            <ChevronRight size={14} />
          </Button>
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={() => onDateChange(new Date())}
          className="h-8 px-3"
        >
          Today
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <span
          className="rounded px-2 py-0.5 text-xs font-medium"
          style={{
            backgroundColor: "var(--color-surface-2)",
            border: "1px solid var(--color-border-subtle)",
            color: "var(--color-text-secondary)",
          }}
        >
          {taskCount} active tasks
        </span>
      </div>
    </div>
  );
}
