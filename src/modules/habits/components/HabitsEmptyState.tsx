"use client";

import { Button } from "@/shared/components/ui/button";

const ACCENT = "var(--color-accent-habits)";

interface Props {
  onCreateClick: () => void;
}

export function HabitsEmptyState({ onCreateClick }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">

      {/* Icon */}
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6"
        style={{
          backgroundColor: "var(--color-surface-2)",
          border: "1px solid var(--color-border-subtle)",
        }}
      >
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ color: ACCENT }}
        >
          <path d="M12 2a10 10 0 1 0 10 10" />
          <path d="M12 6v6l4 2" />
          <circle cx="19" cy="5" r="3" fill={ACCENT} stroke="none" />
        </svg>
      </div>

      {/* Title */}
      <h3
        className="text-base font-semibold mb-2"
        style={{ color: "var(--color-text-primary)" }}
      >
        Start building your routines
      </h3>

      {/* Description */}
      <p
        className="text-sm mb-6 max-w-sm leading-relaxed"
        style={{ color: "var(--color-text-tertiary)" }}
      >
        Small daily actions compound into the life you want. Track your first habit.
      </p>

      {/* Action */}
      <Button
        type="button"
        onClick={onCreateClick}
        className="h-9 px-4 text-sm font-medium text-white hover:opacity-90 transition-all"
        style={{ backgroundColor: ACCENT }}
      >
        + New Habit
      </Button>
    </div>
  );
}
