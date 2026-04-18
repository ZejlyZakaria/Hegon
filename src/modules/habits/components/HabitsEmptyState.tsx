"use client";

import { Button } from "@/shared/components/ui/button";

const ACCENT = "#f43f5e";

interface Props {
  onCreateClick: () => void;
}

export function HabitsEmptyState({ onCreateClick }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-2xl bg-[#f43f5e]/10 border border-zinc-800/60 flex items-center justify-center mb-6">
        <svg
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke={ACCENT}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 2a10 10 0 1 0 10 10" />
          <path d="M12 6v6l4 2" />
          <circle cx="19" cy="5" r="3" fill={ACCENT} stroke="none" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">Start building your routines</h3>
      <p className="text-sm text-zinc-500 mb-6 max-w-sm">
        Small daily actions compound into the life you want. Track your first habit.
      </p>
      <Button
        type="button"
        onClick={onCreateClick}
        style={{ backgroundColor: ACCENT }}
        className="text-white hover:opacity-90"
      >
        + New Habit
      </Button>
    </div>
  );
}
