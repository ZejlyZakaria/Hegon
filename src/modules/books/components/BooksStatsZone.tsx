"use client";

import { CheckCircle2, Library, BookOpen, Star } from "lucide-react";
import type { ElementType } from "react";
import { useBookStats } from "../hooks/useBooks";

const SKY     = "#0ea5e9";
const SKY_BG  = "rgba(14,165,233,0.08)";

export function BooksStatsZone() {
  const { data: stats, isLoading } = useBookStats();

  if (isLoading) {
    return (
      <div className="flex items-stretch gap-2 py-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex-1 h-15 bg-surface-1 rounded-lg border border-border-subtle animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (!stats) return null;

  const avgRating = stats.avg_rating != null
    ? stats.avg_rating.toFixed(1)
    : "—";

  return (
    <div className="flex items-stretch gap-2 py-3">
      <StatCard icon={Library}       value={stats.total}                label="books"     />
      <StatCard icon={BookOpen}      value={stats.reading}              label="reading"   sublabel="in progress" />
      <StatCard icon={CheckCircle2}  value={stats.completed_this_year}  label="completed" sublabel="this year"   />
      <StatCard icon={Star}          value={avgRating}                  label="avg rating" />
    </div>
  );
}

function StatCard({
  icon: Icon,
  value,
  label,
  sublabel,
}: {
  icon: ElementType;
  value: number | string;
  label: string;
  sublabel?: string;
}) {
  return (
    <div className="flex-1 flex items-center gap-3 bg-surface-1 rounded-lg p-3 border border-border-subtle">
      <div
        className="w-8 h-8 rounded-md flex items-center justify-center shrink-0"
        style={{ backgroundColor: SKY_BG }}
      >
        <Icon className="w-4 h-4" style={{ color: SKY }} />
      </div>
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-xl font-bold text-text-primary leading-none">{value}</span>
        <div className="flex items-baseline gap-1">
          <span className="text-xs text-text-tertiary leading-none">{label}</span>
          {sublabel && (
            <span className="text-xs text-text-disabled leading-none">{sublabel}</span>
          )}
        </div>
      </div>
    </div>
  );
}
