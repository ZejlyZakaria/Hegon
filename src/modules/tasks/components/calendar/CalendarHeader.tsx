"use client";

import { ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { format, addMonths, subMonths } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/utils/utils";

// =====================================================
// CALENDAR HEADER
// Month navigation + view switcher
// =====================================================

interface CalendarHeaderProps {
  currentDate: Date;
  onDateChange: (date: Date) => void;
}

export function CalendarHeader({
  currentDate,
  onDateChange,
}: CalendarHeaderProps) {
  const handlePrevMonth = () => {
    onDateChange(subMonths(currentDate, 1));
  };

  const handleNextMonth = () => {
    onDateChange(addMonths(currentDate, 1));
  };

  const handleToday = () => {
    onDateChange(new Date());
  };

  return (
    <div className="h-14 border-b border-white/5 bg-zinc-950/50 backdrop-blur-sm flex items-center justify-between shrink-0 px-4">
      {/* Left: Month navigation */}
      <div className="flex items-center gap-3">
        {/* Month/Year display */}
        <h2 className="text-lg font-semibold text-zinc-100 min-w-45">
          {format(currentDate, "MMMM yyyy")}
        </h2>

        {/* Navigation buttons */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={handlePrevMonth}
            className="h-8 w-8 p-0 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
          >
            <ChevronLeft size={16} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleNextMonth}
            className="h-8 w-8 p-0 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
          >
            <ChevronRight size={16} />
          </Button>
        </div>

        {/* Today button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleToday}
          className="h-8 px-3 text-sm text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
        >
          Today
        </Button>
      </div>

      {/* Right: View switcher */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-3 text-sm text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 gap-2"
          >
            <span>Month</span>
            <ChevronDown size={14} className="text-zinc-500" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-32 rounded-md bg-zinc-900 border-zinc-800"
        >
          <DropdownMenuItem
            className={cn(
              "cursor-pointer focus:bg-zinc-800",
              "text-zinc-100" // Active state
            )}
          >
            Month
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled
            className="cursor-not-allowed text-zinc-600"
          >
            Week
            <span className="ml-auto text-xs text-zinc-600">Soon</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled
            className="cursor-not-allowed text-zinc-600"
          >
            Day
            <span className="ml-auto text-xs text-zinc-600">Soon</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}