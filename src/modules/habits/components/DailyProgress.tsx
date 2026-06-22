"use client";

const ACCENT = "var(--color-accent-habits-vivid)";

// Daily progress — a slim header that caps the Today list. Replaces the old ring
// in the watch rail: a horizontal bar reads better at the top of a vertical list
// (the eye flows down into the rows) and scales from 3 to 15 habits.
export function DailyProgress({
  completed,
  total,
}: {
  completed: number;
  total: number;
}) {
  if (total === 0) return null;

  const pct = Math.round((completed / total) * 100);
  const done = completed >= total;
  const remaining = Math.max(total - completed, 0);
  const microcopy = done ? "All done — legendary" : `${remaining} to go`;

  return (
    <div className="rounded-card bg-surface-1 px-4 py-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-baseline gap-1.5">
          <span className="text-sm font-bold tabular-nums text-text-primary">
            {completed}
          </span>
          <span className="text-sm tabular-nums text-text-tertiary">/ {total}</span>
          <span className="ml-1.5 text-xs text-text-tertiary">done today</span>
        </div>
        <span
          className="text-xs font-medium"
          style={{ color: done ? ACCENT : "var(--color-text-tertiary)" }}
        >
          {microcopy}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
        <div
          className="h-full rounded-full transition-[width] duration-500 ease-out"
          style={{
            width: `${pct}%`,
            backgroundColor: ACCENT,
            boxShadow: done ? `0 0 8px ${ACCENT}` : undefined,
          }}
        />
      </div>
    </div>
  );
}
