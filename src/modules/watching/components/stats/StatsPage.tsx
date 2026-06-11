"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Clock, Film, Tv, Star, Sparkles, Heart, BarChart2,
  Trophy, Play, CalendarDays, Download, Target,
} from "lucide-react";
import { cn } from "@/shared/utils/utils";
import { useCurrentUserId } from "@/shared/hooks/useCurrentUserId";
import { useWatchingStatsData } from "../../hooks/useWatchingStats";
import type { StatsRawItem } from "../../service";
import { displayTitle } from "../../utils";
import { WrappedModal } from "./WrappedModal";
import { computeStats, computeAchievements } from "./computeStats";
import { AchievementGrid } from "@/shared/components/achievements/AchievementGrid";
import { useWatchingGoals } from "../../hooks/useWatchingGoals";
import { goalMetricLabel } from "../../lib/goal-contribution";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/shared/components/ui/select";

// ── Token helpers ─────────────────────────────────────────────────────────────

const TEAL = "var(--color-accent-watching-vivid)";
const GOALS_ACCENT = "var(--color-accent-goals)";

const DONUT_COLORS = {
  film:  "var(--color-accent-watching-vivid)",
  serie: "#818cf8",
  anime: "#fb923c",
} as const;

// ── Export CSV ────────────────────────────────────────────────────────────────

function exportCSV(items: StatsRawItem[]) {
  const header = ["title", "original_title", "type", "year", "watched_at", "user_rating", "favorite", "genres"];
  const rows = items.map((i) => [
    `"${(i.title ?? "").replace(/"/g, '""')}"`,
    `"${(i.original_title ?? "").replace(/"/g, '""')}"`,
    i.type,
    i.year ?? "",
    i.watched_at ? i.watched_at.slice(0, 10) : "",
    i.user_rating ?? "",
    i.favorite ? "true" : "false",
    `"${(i.tags ?? []).join(", ")}"`,
  ]);
  const csv = [header, ...rows].map((r) => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "hegon-watchlist.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// ── Metric card ───────────────────────────────────────────────────────────────

function MetricCard({ label, value, sub, icon }: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl surface-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-surface-2">
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

// ── Hours ─────────────────────────────────────────────────────────────────────

type HoursFilter = "total" | "film" | "serie" | "anime";

function fmtH(value: number) {
  const h = Math.floor(value);
  const m = Math.round((value - h) * 60);
  return { h, m };
}

function HoursCard({ hours }: { hours: ReturnType<typeof computeStats>["hours"] }) {
  const [filter, setFilter] = useState<HoursFilter>("total");

  const SEGMENTS = [
    { key: "film"  as const, val: hours.film,  color: DONUT_COLORS.film,  label: "Films" },
    { key: "serie" as const, val: hours.serie, color: DONUT_COLORS.serie, label: "Shows" },
    { key: "anime" as const, val: hours.anime, color: DONUT_COLORS.anime, label: "Anime" },
  ];

  const ringTotal = (hours.film + hours.serie + hours.anime) || 1;
  const { h, m } = fmtH(hours[filter]);

  const R    = 15.9;
  const CIRC = 2 * Math.PI * R;
  let cumulative = 0;
  const donutSegments = SEGMENTS.map((seg) => {
    const dash   = (seg.val / ringTotal) * CIRC;
    const offset = CIRC - cumulative;
    cumulative  += dash;
    return { ...seg, dash, offset };
  });

  const centerLabel = filter === "total"
    ? "total"
    : SEGMENTS.find((s) => s.key === filter)?.label.toLowerCase() ?? "";

  return (
    <div className="rounded-xl surface-card p-5 h-60 flex flex-col overflow-hidden">
      <div className="mb-3 flex items-center gap-2 shrink-0">
        <Clock size={14} className="text-text-tertiary" />
        <p className="text-sm font-semibold text-text-primary">Hours Watched</p>
      </div>

      <div className="flex flex-1 gap-4 min-h-0">
        <div className="relative w-1/2 min-h-0 p-2">
          <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
            <circle cx="18" cy="18" r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="2.5" />
            {donutSegments.map((seg) => (
              <circle
                key={seg.key}
                cx="18" cy="18" r={R}
                fill="none"
                stroke={seg.color}
                strokeWidth="2.5"
                strokeDasharray={`${seg.dash} ${CIRC - seg.dash}`}
                strokeDashoffset={seg.offset}
                opacity={filter === "total" || filter === seg.key ? 1 : 0.15}
                className="cursor-pointer transition-opacity duration-300"
                onClick={() => setFilter(filter === seg.key ? "total" : seg.key)}
              />
            ))}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <p className="text-xl font-bold tabular-nums text-text-primary leading-none">
              {h}<span className="text-sm font-normal text-text-tertiary">h</span>
              {m > 0 && <>{" "}{m}<span className="text-sm font-normal text-text-tertiary">m</span></>}
            </p>
            <p className="mt-0.5 text-[10px] text-text-tertiary/50">{centerLabel}</p>
          </div>
        </div>

        <div className="w-1/2 flex flex-col justify-center gap-1.5">
          {SEGMENTS.map((seg) => {
            const { h: sh, m: sm } = fmtH(seg.val);
            return (
              <button
                key={seg.key}
                type="button"
                onClick={() => setFilter(filter === seg.key ? "total" : seg.key)}
                className={cn(
                  "flex items-center justify-between rounded-lg px-2.5 py-1.5 transition-colors text-left w-full",
                  filter === seg.key ? "bg-surface-2" : "hover:bg-surface-2/40",
                )}
              >
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
                  <span className="text-xs text-text-secondary">{seg.label}</span>
                </div>
                <span className="text-xs tabular-nums text-text-tertiary">
                  {sh}h{sm > 0 ? ` ${sm}m` : ""}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Top Picks ─────────────────────────────────────────────────────────────────

const RANK_LABELS = ["#1", "#2", "#3"];
const RANK_COLORS = ["rgba(245,158,11,0.9)", "rgba(148,163,184,0.7)", "rgba(180,120,60,0.7)"];

function TopFavoritesCard({ items }: { items: StatsRawItem[] }) {
  const router = useRouter();

  return (
    <div className="rounded-xl surface-card p-5">
      <div className="mb-4 flex items-center gap-2">
        <Trophy size={14} className="text-text-tertiary" />
        <p className="text-sm font-semibold text-text-primary">Top Picks</p>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-text-tertiary/50">Rate or favorite items to see your top picks</p>
      ) : (
        <div className="flex flex-col gap-0.5">
          {items.map((item, i) => (
            <div
              key={item.id}
              className="group flex cursor-pointer items-center gap-3 -mx-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-surface-2"
              onClick={() => router.push(`/perso/watching/${item.id}`)}
            >
              <span
                className="w-5 shrink-0 text-center text-[11px] font-bold tabular-nums"
                style={{ color: RANK_COLORS[i] }}
              >
                {RANK_LABELS[i]}
              </span>
              <div className="relative h-15 w-10 shrink-0 overflow-hidden rounded-lg">
                {item.poster_url ? (
                  <Image
                    src={item.poster_url}
                    alt={item.title}
                    fill
                    unoptimized
                    className="object-cover"
                    sizes="40px"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-surface-2">
                    <Play size={12} className="text-text-tertiary" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-text-primary">{displayTitle(item)}</p>
                <div className="mt-0.5 flex items-center gap-2">
                  {item.user_rating != null && (
                    <div className="flex items-center gap-1">
                      <Star size={10} className="fill-amber-400 text-amber-400" />
                      <span className="text-[11px] tabular-nums text-amber-400 font-medium">
                        {item.user_rating}
                      </span>
                    </div>
                  )}
                  <span className="text-[11px] text-text-tertiary/50">{item.year}</span>
                </div>
              </div>
              {item.favorite && (
                <Heart size={11} className="shrink-0 fill-red-400 text-red-400 opacity-70" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Top Genres ────────────────────────────────────────────────────────────────

function TopGenresCard({ genres }: { genres: ReturnType<typeof computeStats>["topGenres"] }) {
  const max = genres[0]?.count ?? 1;

  return (
    <div className="rounded-xl surface-card p-5">
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
              <div
                className="flex-1 overflow-hidden rounded-full h-1.5"
                style={{ backgroundColor: "rgba(255,255,255,0.06)" }}
              >
                <div
                  className="h-full rounded-full transition-[width] duration-700"
                  style={{
                    width: `${(g.count / max) * 100}%`,
                    backgroundColor: TEAL,
                    opacity: Math.max(0.3, 1 - i * 0.12),
                  }}
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

// ── Rating Distribution ───────────────────────────────────────────────────────

function RatingDistributionCard({ distribution }: { distribution: ReturnType<typeof computeStats>["ratingDistribution"] }) {
  const total = distribution.reduce((s, d) => s + d.count, 0);

  const rated = distribution.filter((d) => d.count > 0);
  const minScore = rated[0]?.score ?? 1;
  const maxScore = rated[rated.length - 1]?.score ?? 10;
  const visible = distribution.filter((d) => d.score >= minScore && d.score <= maxScore);

  const max = Math.max(...visible.map((d) => d.count), 1);

  const W = 200, H = 72;
  const PAD_X = 2, PAD_Y = 6;
  const plotW = W - PAD_X * 2;
  const plotH = H - PAD_Y * 2;

  const pts = visible.map((d, i) => ({
    x: visible.length > 1
      ? PAD_X + (i / (visible.length - 1)) * plotW
      : W / 2,
    y: PAD_Y + plotH - (d.count / max) * plotH,
    score: d.score,
    count: d.count,
  }));

  const linePath = pts.reduce((acc, p, i) => {
    if (i === 0) return `M ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
    const prev = pts[i - 1];
    const cpX = ((prev.x + p.x) / 2).toFixed(1);
    return `${acc} C ${cpX} ${prev.y.toFixed(1)}, ${cpX} ${p.y.toFixed(1)}, ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
  }, "");

  const areaPath = pts.length > 0
    ? `${linePath} L ${pts[pts.length - 1].x.toFixed(1)} ${H} L ${pts[0].x.toFixed(1)} ${H} Z`
    : "";

  return (
    <div className="rounded-xl surface-card p-5 h-60 w-full flex flex-col overflow-hidden">
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
        <div className="flex flex-1 flex-col min-h-0 gap-2">
          <div className="flex-1 min-h-0">
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" preserveAspectRatio="none">
              <defs>
                <linearGradient id="ratingAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   style={{ stopColor: TEAL, stopOpacity: 0.20 }} />
                  <stop offset="100%" style={{ stopColor: TEAL, stopOpacity: 0 }} />
                </linearGradient>
              </defs>
              <path d={areaPath} fill="url(#ratingAreaGrad)" />
              <path d={linePath} fill="none" style={{ stroke: TEAL }} strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
              {pts.filter((p) => p.count > 0).map((p) => (
                <circle key={p.score} cx={p.x} cy={p.y} r="1.6" style={{ fill: TEAL }} />
              ))}
            </svg>
          </div>
          <div className="flex shrink-0">
            {visible.map((d) => (
              <div key={d.score} className="flex flex-1 justify-center">
                <span className="text-[9px] tabular-nums text-text-tertiary/70">{d.score}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Activity ──────────────────────────────────────────────────────────────────

function ActivityCard({ activity, year, streaks }: {
  activity: ReturnType<typeof computeStats>["activity"];
  year: number | null;
  streaks: ReturnType<typeof computeStats>["streaks"];
}) {
  const max = Math.max(...activity.map((a) => a.count), 1);
  const title = year ? "Monthly Activity" : "Yearly Activity";

  return (
    <div className="rounded-xl surface-card p-5 h-60 flex flex-col overflow-hidden">
      <div className="mb-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <CalendarDays size={14} className="text-text-tertiary" />
          <p className="text-sm font-semibold text-text-primary">{title}</p>
        </div>
        {streaks.bestMonth && (
          <p className="text-[10px] text-text-tertiary/50 tabular-nums">
            Best: <span className="text-text-tertiary">{streaks.bestMonth.label}</span> ({streaks.bestMonth.count})
          </p>
        )}
      </div>

      {activity.length === 0 ? (
        <p className="text-sm text-text-tertiary/50">No activity yet</p>
      ) : (
        <div className="flex flex-1 items-end gap-1 min-h-0">
          {activity.map((a) => (
            <div key={a.label} className="flex flex-1 flex-col items-center gap-1">
              <div
                className="w-full rounded-t-sm transition-[height] duration-500"
                style={{
                  height: a.count > 0 ? `${Math.max(4, (a.count / max) * 60)}px` : 0,
                  backgroundColor: TEAL,
                  opacity: a.count > 0 ? Math.max(0.25, a.count / max) : 0,
                }}
              />
              <span className="text-[9px] tabular-nums text-text-tertiary/70 leading-none">{a.label}</span>
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
    <div className="space-y-4 p-4 md:p-6 animate-pulse">
      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {[1, 2, 3].map((i) => <div key={i} className="h-7 w-16 shrink-0 rounded-lg bg-surface-1" />)}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-28 rounded-xl bg-surface-1" />)}
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {[1, 2, 3].map((i) => <div key={i} className="h-60 rounded-xl bg-surface-1" />)}
      </div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="h-52 rounded-xl bg-surface-1" />
        <div className="h-52 rounded-xl bg-surface-1" />
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function StatsPage() {
  const router = useRouter();
  const userId = useCurrentUserId();
  const { data: rawData = [], isLoading } = useWatchingStatsData(userId ?? "");
  const { data: watchingGoals = [] } = useWatchingGoals();
  const [selectedYear, setSelectedYear] = useState<number | null>(() => new Date().getFullYear());
  const [wrappedOpen, setWrappedOpen] = useState(false);

  const stats = useMemo(() => computeStats(rawData, selectedYear), [rawData, selectedYear]);
  const achievements = useMemo(() => computeAchievements(rawData), [rawData]);

  if (!userId || isLoading) return <StatsSkeleton />;

  const currentYear = new Date().getFullYear();
  const years = stats.availableYears.filter((y) => y <= currentYear);

  return (
    <div className="space-y-4 p-4 md:p-6">

      {/* Year Wrapped modal */}
      {wrappedOpen && selectedYear && (
        <WrappedModal
          year={selectedYear}
          films={stats.counts.film}
          seriesAnime={stats.counts.serie + stats.counts.anime}
          hours={stats.hours.total}
          topGenre={stats.topGenres[0]?.name ?? null}
          topPosters={stats.wrappedPosters}
          total={stats.counts.total}
          onClose={() => setWrappedOpen(false)}
        />
      )}

      {/* Year filter + actions */}
      <div className="flex items-center gap-2">
        {/* Desktop: year pills */}
        <div className="hidden flex-1 items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex">
          <button
            type="button"
            onClick={() => setSelectedYear(null)}
            className={cn(
              "shrink-0 rounded-lg px-4 py-1.5 text-xs font-medium transition-colors border",
              selectedYear === null
                ? "bg-white text-black border-white"
                : "border-border-default text-text-tertiary hover:text-text-secondary hover:border-border-strong",
            )}
          >
            All time
          </button>
          {years.map((year) => (
            <button
              key={year}
              type="button"
              onClick={() => setSelectedYear(year)}
              className={cn(
                "shrink-0 rounded-lg px-4 py-1.5 text-xs font-medium transition-colors border",
                selectedYear === year
                  ? "bg-white text-black border-white"
                  : "border-border-default text-text-tertiary hover:text-text-secondary hover:border-border-strong",
              )}
            >
              {year}
            </button>
          ))}
        </div>

        {/* Mobile: year select */}
        <div className="flex-1 sm:hidden">
          <Select
            value={selectedYear === null ? "all" : String(selectedYear)}
            onValueChange={(v) => setSelectedYear(v === "all" ? null : Number(v))}
          >
            <SelectTrigger className="h-9 w-full bg-surface-1 border-border-subtle text-text-secondary text-sm focus:ring-0 focus:ring-offset-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-surface-3 border-border-strong text-text-secondary">
              <SelectItem value="all" className="text-sm focus:bg-surface-2 focus:text-text-primary cursor-pointer">
                All time
              </SelectItem>
              {years.map((year) => (
                <SelectItem
                  key={year}
                  value={String(year)}
                  className="text-sm focus:bg-surface-2 focus:text-text-primary cursor-pointer"
                >
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {/* Export CSV */}
          <button
            type="button"
            onClick={() => exportCSV(rawData)}
            className="flex items-center gap-1.5 rounded-lg border border-border-default px-3 py-1.5 text-xs font-medium text-text-tertiary transition-colors hover:border-border-strong hover:text-text-secondary"
            title="Export watchlist as CSV"
          >
            <Download size={12} />
            Export
          </button>

          {/* Wrapped */}
          {selectedYear && (
            <button
              type="button"
              onClick={() => setWrappedOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border border-[rgba(45,212,191,0.3)] bg-[rgba(45,212,191,0.08)] px-3 py-1.5 text-xs font-semibold text-[#2dd4bf] transition-colors hover:bg-[rgba(45,212,191,0.14)]"
            >
              <Sparkles size={12} />
              {selectedYear} Wrapped
            </button>
          )}
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <MetricCard
          label="Total watched"
          value={stats.counts.total}
          icon={<Play size={14} style={{ color: TEAL }} />}
        />
        <MetricCard
          label="Films"
          value={stats.counts.film}
          icon={<Film size={14} style={{ color: TEAL }} />}
        />
        <MetricCard
          label="TV Shows"
          value={stats.counts.serie}
          icon={<Tv size={14} style={{ color: TEAL }} />}
        />
        <MetricCard
          label="Anime"
          value={stats.counts.anime}
          icon={<Sparkles size={14} style={{ color: TEAL }} />}
        />
        <MetricCard
          label="Avg rating"
          value={stats.avgRating ?? "—"}
          sub={stats.avgRating && stats.ratedCount > 0 ? `(${stats.ratedCount})` : undefined}
          icon={<Star size={14} className="fill-amber-400 text-amber-400" />}
        />
      </div>

      {/* Your Watching Goals — cross-module connection surfaced in Stats */}
      {watchingGoals.length > 0 && (
        <div>
          <div className="mb-3 flex items-center gap-2">
            <Target size={14} style={{ color: GOALS_ACCENT }} />
            <h2 className="text-sm font-semibold text-text-primary">Your Watching Goals</h2>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {watchingGoals.map((g) => {
              const target = g.metric_target ?? 0;
              const count  = g.metric_current; // exact count from the backend, never a % reconstruction
              const pct    = target > 0 ? Math.min(100, (count / target) * 100) : g.progress;
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => router.push(`/life/goals/${g.id}`)}
                  className="group cursor-pointer rounded-xl surface-card p-4 text-left transition-colors hover:border-border-default"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium text-text-primary">{g.title}</p>
                    <span className="shrink-0 text-xs tabular-nums text-text-tertiary">{count}/{target}</span>
                  </div>
                  <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full rounded-full transition-[width] duration-500"
                      style={{ width: `${pct}%`, backgroundColor: GOALS_ACCENT }}
                    />
                  </div>
                  <p className="mt-1.5 text-[11px] text-text-tertiary">
                    {Math.round(pct)}% · {goalMetricLabel(g)} {g.metric_period === "year" ? `in ${g.metric_year}` : "all-time"}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Row 2 — charts */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <HoursCard hours={stats.hours} />
        <ActivityCard activity={stats.activity} year={selectedYear} streaks={stats.streaks} />
        <RatingDistributionCard distribution={stats.ratingDistribution} />
      </div>

      {/* Top Picks + Genres */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <TopFavoritesCard items={stats.topFavorites} />
        <TopGenresCard genres={stats.topGenres} />
      </div>

      {/* Achievements — all-time, shared UI identical across every HEGON module */}
      <AchievementGrid achievements={achievements} accent={TEAL} />

    </div>
  );
}
