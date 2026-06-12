"use client";

import { CheckCircle2, Library, BookOpen, Star, Heart } from "lucide-react";
import type { ReactNode } from "react";
import { useBookStats } from "../hooks/useBooks";
import { StatsZoneSkeleton } from "./BooksSkeleton";

const ACCENT = "var(--color-accent-books-vivid)";

// Mirrors the Watching Stats MetricCard exactly (surface-card material,
// icon-in-box + label on top, big value below) for cross-module consistency.

export function BooksStatsZone() {
  const { data: stats, isLoading } = useBookStats();

  if (isLoading) return <StatsZoneSkeleton />;

  if (!stats) return null;

  const avgRating = stats.avg_rating != null ? stats.avg_rating.toFixed(1) : "—";

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <MetricCard label="Total"      value={stats.total}               icon={<Library     size={14} style={{ color: ACCENT }} />} />
      <MetricCard label="Reading"    value={stats.reading}             icon={<BookOpen    size={14} style={{ color: ACCENT }} />} />
      <MetricCard label="Completed"  value={stats.completed_this_year} icon={<CheckCircle2 size={14} style={{ color: ACCENT }} />} />
      <MetricCard label="Favorites"  value={stats.favorites}           icon={<Heart       size={14} className="fill-red-400 text-red-400" />} />
      <MetricCard label="Avg rating" value={avgRating}                 icon={<Star        size={14} className="fill-amber-400 text-amber-400" />} />
    </div>
  );
}

function MetricCard({ label, value, icon }: { label: string; value: string | number; icon: ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-xl surface-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-surface-2">{icon}</div>
        <p className="text-sm font-medium text-text-secondary">{label}</p>
      </div>
      <p className="text-2xl font-bold tabular-nums text-text-primary">{value}</p>
    </div>
  );
}
