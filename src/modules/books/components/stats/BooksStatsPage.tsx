"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen, Layers, Star, FileText, Heart, BarChart2,
  CalendarDays, Trophy, Users, Target,
} from "lucide-react";
import { cn } from "@/shared/utils/utils";
import { useBooks, useReadingLog, useBookSettings, useSetMonthlyTarget } from "../../hooks/useBooks";
import { useBooksGoals } from "../../hooks/useBooksGoals";
import { computeBookStats, computeBookAchievements } from "../../lib/compute-stats";
import { AchievementGrid } from "@/shared/components/achievements/AchievementGrid";
import { MetricCard } from "@/shared/components/stats/MetricCard";
import { FadeIn } from "@/shared/components/ui/motion";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/shared/components/ui/select";
import type { Book } from "../../types";

const BOOKS = "var(--color-accent-books-vivid)";
const GOALS_ACCENT = "var(--color-accent-goals)";

// ── Activity (bars) ───────────────────────────────────────────────────────────

function ActivityCard({ activity, year, bestMonth, monthlyTarget, onSetTarget }: {
  activity: { label: string; count: number }[];
  year: number | null;
  bestMonth: { label: string; count: number } | null;
  monthlyTarget: number | null;
  onSetTarget: (target: number | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  // The reference line — the monthly target as-is on the year view, annualised (×12)
  // on the all-time (yearly) view. The editor always edits the monthly value.
  const lineTarget = monthlyTarget && monthlyTarget > 0 ? (year ? monthlyTarget : monthlyTarget * 12) : null;
  const maxBar = Math.max(...activity.map((a) => a.count), 1);
  const chartMax = Math.max(maxBar, lineTarget ?? 0);
  const H = 128; // px — bar/line reference height from the baseline

  const commit = () => {
    const n = parseInt(draft, 10);
    onSetTarget(Number.isFinite(n) && n > 0 ? n : null);
    setEditing(false);
  };

  return (
    <div className="rounded-card surface-card p-5 h-60 flex flex-col overflow-hidden">
      <div className="mb-3 flex items-start justify-between gap-2 shrink-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <CalendarDays size={14} className="text-text-tertiary" />
            <p className="text-sm font-semibold text-text-primary">{year ? "Monthly Activity" : "Yearly Activity"}</p>
          </div>
          {bestMonth && bestMonth.count > 0 && (
            <p className="mt-0.5 text-[10px] tabular-nums text-text-tertiary/60">Best: {bestMonth.label} ({bestMonth.count})</p>
          )}
        </div>

        {/* Inline target editor (always the monthly value) */}
        {editing ? (
          <input
            autoFocus
            type="number"
            min={1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
            placeholder="pages"
            className="h-7 w-20 shrink-0 rounded-control bg-surface-2 px-2 text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-border-focus"
          />
        ) : (
          <button
            type="button"
            onClick={() => { setDraft(monthlyTarget ? String(monthlyTarget) : ""); setEditing(true); }}
            className="flex shrink-0 items-center gap-1 rounded-control bg-surface-2 px-2 py-1 text-[11px] text-text-secondary transition-colors hover:bg-surface-3"
            title="Monthly pages target"
          >
            <Target size={11} className="text-text-tertiary" />
            {monthlyTarget ? `${monthlyTarget}/mo` : "Set target"}
          </button>
        )}
      </div>

      {activity.length === 0 ? (
        <p className="text-sm text-text-tertiary/50">No reading activity yet</p>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="relative flex flex-1 items-end gap-1">
            {lineTarget != null && (
              <div
                className="pointer-events-none absolute inset-x-0 z-10 border-t border-dashed border-text-tertiary/40"
                style={{ bottom: `${(lineTarget / chartMax) * H}px` }}
              >
                <span className="absolute -top-3.5 right-0 text-[9px] tabular-nums text-text-tertiary/60">
                  {lineTarget.toLocaleString()}
                </span>
              </div>
            )}
            {activity.map((a) => (
              <div
                key={a.label}
                className="flex-1 rounded-t-sm transition-[height] duration-500"
                style={{
                  height: a.count > 0 ? `${Math.max(4, (a.count / chartMax) * H)}px` : 0,
                  backgroundColor: BOOKS,
                  opacity: a.count > 0 ? Math.max(0.3, a.count / chartMax) : 0,
                }}
              />
            ))}
          </div>
          <div className="mt-1 flex gap-1">
            {activity.map((a) => (
              <span key={a.label} className="flex-1 text-center text-[9px] tabular-nums leading-none text-text-tertiary/70">{a.label}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Rating distribution (1–5 bars) ────────────────────────────────────────────

function RatingDistributionCard({ distribution }: { distribution: { score: number; count: number }[] }) {
  const total = distribution.reduce((s, d) => s + d.count, 0);
  const max = Math.max(...distribution.map((d) => d.count), 1);
  return (
    <div className="rounded-card surface-card p-5 h-60 flex flex-col overflow-hidden">
      <div className="mb-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Star size={14} className="text-text-tertiary" />
          <p className="text-sm font-semibold text-text-primary">Rating Distribution</p>
        </div>
        {total > 0 && <p className="text-xs text-text-tertiary/60">{total} rated</p>}
      </div>
      {total === 0 ? (
        <p className="text-sm text-text-tertiary/50">No ratings yet</p>
      ) : (
        <div className="flex flex-1 items-end justify-around gap-3 min-h-0">
          {distribution.map((d) => (
            <div key={d.score} className="flex flex-1 flex-col items-center gap-1.5">
              <span className="text-[10px] tabular-nums text-text-tertiary">{d.count}</span>
              <div
                className="w-full max-w-10 rounded-t-md transition-[height] duration-500"
                style={{
                  height: d.count > 0 ? `${Math.max(4, (d.count / max) * 120)}px` : 2,
                  backgroundColor: BOOKS,
                  opacity: d.count > 0 ? Math.max(0.3, d.count / max) : 0.15,
                }}
              />
              <div className="flex items-center gap-0.5">
                <Star size={9} className="fill-amber-400 text-amber-400" />
                <span className="text-[10px] tabular-nums text-text-tertiary">{d.score}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Top genres (horizontal bars) ──────────────────────────────────────────────

function TopGenresCard({ genres }: { genres: { name: string; count: number }[] }) {
  const max = genres[0]?.count ?? 1;
  return (
    <div className="rounded-card surface-card p-5">
      <div className="mb-4 flex items-center gap-2">
        <BarChart2 size={14} className="text-text-tertiary" />
        <p className="text-sm font-semibold text-text-primary">Top Genres</p>
      </div>
      {genres.length === 0 ? (
        <p className="text-sm text-text-tertiary/50">No genre data yet</p>
      ) : (
        <div className="space-y-3">
          {genres.map((g, i) => (
            <div key={g.name} className="flex items-center gap-3">
              <span className="w-32 shrink-0 truncate text-sm text-text-secondary">{g.name}</span>
              <div className="flex-1 overflow-hidden rounded-full h-1.5" style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>
                <div
                  className="h-full rounded-full transition-[width] duration-700"
                  style={{ width: `${(g.count / max) * 100}%`, backgroundColor: BOOKS, opacity: Math.max(0.3, 1 - i * 0.12) }}
                />
              </div>
              <span className="w-5 text-right text-xs tabular-nums text-text-tertiary">{g.count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Top rated ─────────────────────────────────────────────────────────────────

const RANK_LABELS = ["#1", "#2", "#3"];
const RANK_COLORS = ["rgba(245,158,11,0.9)", "rgba(148,163,184,0.7)", "rgba(180,120,60,0.7)"];

function TopRatedCard({ items }: { items: Book[] }) {
  const router = useRouter();
  return (
    <div className="rounded-card surface-card p-5">
      <div className="mb-4 flex items-center gap-2">
        <Trophy size={14} className="text-text-tertiary" />
        <p className="text-sm font-semibold text-text-primary">Top Picks</p>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-text-tertiary/50">Rate or favorite books to see your top picks</p>
      ) : (
        <div className="flex flex-col gap-0.5">
          {items.map((b, i) => (
            <div
              key={b.id}
              className="group flex cursor-pointer items-center gap-3 -mx-2 rounded-control px-2 py-1.5 transition-colors hover:bg-surface-2"
              onClick={() => router.push(`/life/books/${b.id}`)}
            >
              <span className="w-5 shrink-0 text-center text-[11px] font-bold tabular-nums" style={{ color: RANK_COLORS[i] }}>
                {RANK_LABELS[i]}
              </span>
              <div className="relative h-15 w-10 shrink-0 overflow-hidden rounded-tile bg-surface-2">
                {b.cover_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={b.cover_url} alt={b.title} loading="eager" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center"><BookOpen size={12} className="text-text-tertiary" /></div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-text-primary">{b.title}</p>
                <div className="mt-0.5 flex items-center gap-2">
                  {b.rating != null && (
                    <div className="flex items-center gap-1">
                      <Star size={10} className="fill-amber-400 text-amber-400" />
                      <span className="text-[11px] tabular-nums font-medium text-amber-400">{b.rating}</span>
                    </div>
                  )}
                  {b.author && <span className="truncate text-[11px] text-text-tertiary/60">{b.author}</span>}
                </div>
              </div>
              {b.favorite && <Heart size={11} className="shrink-0 fill-red-400 text-red-400 opacity-70" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Top authors ───────────────────────────────────────────────────────────────

function TopAuthorsCard({ authors }: { authors: { name: string; count: number }[] }) {
  const max = authors[0]?.count ?? 1;
  return (
    <div className="rounded-card surface-card p-5">
      <div className="mb-4 flex items-center gap-2">
        <Users size={14} className="text-text-tertiary" />
        <p className="text-sm font-semibold text-text-primary">Top Authors</p>
      </div>
      {authors.length === 0 ? (
        <p className="text-sm text-text-tertiary/50">No author data yet</p>
      ) : (
        <div className="space-y-3">
          {authors.map((a, i) => (
            <div key={a.name} className="flex items-center gap-3">
              <span className="w-36 shrink-0 truncate text-sm text-text-secondary">{a.name}</span>
              <div className="flex-1 overflow-hidden rounded-full h-1.5" style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>
                <div
                  className="h-full rounded-full transition-[width] duration-700"
                  style={{ width: `${(a.count / max) * 100}%`, backgroundColor: BOOKS, opacity: Math.max(0.3, 1 - i * 0.12) }}
                />
              </div>
              <span className="w-5 text-right text-xs tabular-nums text-text-tertiary">{a.count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function StatsSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-9 w-64 rounded-control bg-surface-2" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-28 rounded-card bg-surface-2" />)}
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {[1, 2, 3].map((i) => <div key={i} className="h-60 rounded-card bg-surface-2" />)}
      </div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="h-52 rounded-card bg-surface-2" />
        <div className="h-52 rounded-card bg-surface-2" />
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function BooksStatsPage() {
  const router = useRouter();
  const { data: books = [], isLoading } = useBooks();
  const { data: goals = [] } = useBooksGoals();
  const [selectedYear, setSelectedYear] = useState<number | null>(() => new Date().getFullYear());
  // Fetch the ALL-TIME log once; computeBookStats scopes it to the selected year,
  // and achievements (all-time) use the full set.
  const { data: logRows = [] } = useReadingLog(null);
  const { data: settings } = useBookSettings();
  const setTarget = useSetMonthlyTarget();

  const stats = useMemo(() => computeBookStats(books, selectedYear, logRows), [books, selectedYear, logRows]);
  const achievements = useMemo(() => computeBookAchievements(books, logRows), [books, logRows]);

  if (isLoading) return <StatsSkeleton />;

  const currentYear = new Date().getFullYear();
  // Always include the current year so the default selection has a visible pill,
  // even before any book is finished this year.
  const years = [...new Set([currentYear, ...stats.availableYears])]
    .filter((y) => y <= currentYear)
    .sort((a, b) => b - a);
  // "All time" only makes sense once there's more than one year to aggregate —
  // with a single year it's identical to that year's view.
  const showAllTime = years.length >= 2;

  return (
    <FadeIn className="space-y-4">
      {/* Year filter */}
      <div className="flex items-center gap-2">
        <div className="hidden flex-1 items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex">
          {showAllTime && (
            <button
              type="button"
              onClick={() => setSelectedYear(null)}
              className={cn(
                "shrink-0 rounded-control px-4 py-1.5 text-xs font-medium transition-colors border",
                selectedYear === null
                  ? "bg-white text-black border-white"
                  : "border-border-default text-text-tertiary hover:text-text-secondary hover:border-border-strong",
              )}
            >
              All time
            </button>
          )}
          {years.map((year) => (
            <button
              key={year}
              type="button"
              onClick={() => setSelectedYear(year)}
              className={cn(
                "shrink-0 rounded-control px-4 py-1.5 text-xs font-medium transition-colors border",
                selectedYear === year
                  ? "bg-white text-black border-white"
                  : "border-border-default text-text-tertiary hover:text-text-secondary hover:border-border-strong",
              )}
            >
              {year}
            </button>
          ))}
        </div>
        <div className="flex-1 sm:hidden">
          <Select
            value={selectedYear === null ? "all" : String(selectedYear)}
            onValueChange={(v) => setSelectedYear(v === "all" ? null : Number(v))}
          >
            <SelectTrigger variant="legacy" className="h-9 w-full bg-surface-1 border-border-subtle text-text-secondary text-sm focus:ring-0 focus:ring-offset-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent variant="legacy" className="bg-surface-3 border-border-strong text-text-secondary">
              {showAllTime && (
                <SelectItem value="all" className="text-sm focus:bg-surface-2 focus:text-text-primary cursor-pointer">All time</SelectItem>
              )}
              {years.map((year) => (
                <SelectItem key={year} value={String(year)} className="text-sm focus:bg-surface-2 focus:text-text-primary cursor-pointer">
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <MetricCard label="Books read" value={stats.read} icon={<BookOpen size={14} style={{ color: BOOKS }} />} />
        <MetricCard label="Pages read" value={stats.pagesRead.toLocaleString()} icon={<FileText size={14} style={{ color: BOOKS }} />} />
        <MetricCard label="Avg rating" value={stats.avgRating ?? "—"} sub={stats.avgRating && stats.ratedCount > 0 ? `(${stats.ratedCount})` : undefined} icon={<Star size={14} className="fill-amber-400 text-amber-400" />} />
        <MetricCard label="Avg length" value={stats.avgPages ?? "—"} sub={stats.avgPages ? "pages" : undefined} icon={<Layers size={14} style={{ color: BOOKS }} />} />
        <MetricCard label="Favorites" value={stats.favorites} icon={<Heart size={14} className="fill-red-400 text-red-400" />} />
      </div>

      {/* Your Reading Goals — cross-module */}
      {goals.length > 0 && (
        <div>
          <div className="mb-3 flex items-center gap-2">
            <Target size={14} style={{ color: GOALS_ACCENT }} />
            <h2 className="text-sm font-semibold text-text-primary">Your Reading Goals</h2>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {goals.map((g) => {
              const target = g.metric_target ?? 0;
              const count = g.metric_current;
              const pct = target > 0 ? Math.min(100, (count / target) * 100) : g.progress;
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => router.push(`/life/goals/${g.id}`)}
                  className="group cursor-pointer rounded-card surface-card p-4 text-left transition-colors hover:border-border-default"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium text-text-primary">{g.title}</p>
                    <span className="shrink-0 text-xs tabular-nums text-text-tertiary">{count}/{target}</span>
                  </div>
                  <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                    <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${pct}%`, backgroundColor: GOALS_ACCENT }} />
                  </div>
                  <p className="mt-1.5 text-[11px] text-text-tertiary">
                    {Math.round(pct)}% · books {g.metric_period === "year" ? `in ${g.metric_year}` : "all-time"}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <ActivityCard
          activity={stats.activity}
          year={selectedYear}
          bestMonth={stats.bestMonth}
          monthlyTarget={settings?.monthly_pages_target ?? null}
          onSetTarget={(t) => setTarget.mutate(t)}
        />
        <RatingDistributionCard distribution={stats.ratingDistribution} />
        <TopGenresCard genres={stats.topGenres} />
      </div>

      {/* Top rated + authors */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <TopRatedCard items={stats.topRated} />
        <TopAuthorsCard authors={stats.topAuthors} />
      </div>

      {/* Achievements */}
      <AchievementGrid achievements={achievements} accent={BOOKS} />
    </FadeIn>
  );
}
