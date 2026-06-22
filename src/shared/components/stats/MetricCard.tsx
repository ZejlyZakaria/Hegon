import type { ReactNode } from "react";

// Canonical stats metric card — the single source for the metric-strip card used
// across Watching, Books and Habits stats (was duplicated in each module). Icon
// colour is set by the caller (module accent or a semantic colour).
export function MetricCard({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-card surface-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-tile bg-surface-2">
          {icon}
        </div>
        <p className="text-sm font-medium text-text-secondary">{label}</p>
      </div>
      <div className="flex items-baseline gap-1.5">
        <p className="text-2xl font-bold tabular-nums text-text-primary">{value}</p>
        {sub && <span className="text-[11px] text-text-tertiary">{sub}</span>}
      </div>
    </div>
  );
}
