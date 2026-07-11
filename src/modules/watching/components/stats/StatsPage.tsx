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
import { useWatchingUIStore } from "../../hooks/useWatchingUIStore";
import { StatsSkeleton } from "../shared/WatchingSkeletons";
import type { StatsRawItem } from "../../service";
import { displayTitle } from "../../utils";
import { WrappedModal } from "./WrappedModal";
import { computeStats, computeAchievements } from "./computeStats";
import { AchievementGrid } from "@/shared/components/achievements/AchievementGrid";
import { useWatchingGoals } from "../../hooks/useWatchingGoals";
import { goalMetricLabel } from "../../lib/goal-contribution";
import { Button } from "@/shared/components/ui/button";
import { FilterSelect } from "@/shared/components/ui/filter-select";
import { Hint } from "@/shared/components/ui/tooltip";

// ── Token helpers ─────────────────────────────────────────────────────────────

const TEAL = "var(--color-accent-watching-vivid)";
const GOALS_ACCENT = "var(--color-accent-goals)";

const DONUT_COLORS = {
  film:  "var(--color-accent-watching-vivid)",
  serie: "#818cf8",
  anime: "#fb923c",
  rewatches: "#f472b6",
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
    <div className="relative overflow-hidden rounded-card surface-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-surface-2">
          {icon}
        </div>
        <p className="text-sm font-medium text-text-secondary">{label}</p>
      </div>
      <div className="flex flex-wrap items-baseline gap-x-1.5">
        <p className="text-2xl font-bold tabular-nums text-text-primary">{value}</p>
        {sub && <span className="text-[11px] text-text-tertiary">{sub}</span>}
      </div>
    </div>
  );
}

// Status breakdown line for the TV Shows / Anime cards — only the non-empty statuses,
// same wording as before plus paused/dropped. Wraps if long (that's fine). Hidden
// when everything is watched (the value already says it).
function statusSub(s: { watched: number; inProgress: number; paused: number; dropped: number }): string | undefined {
  if (s.inProgress + s.paused + s.dropped === 0) return undefined;
  const parts: string[] = [];
  if (s.watched > 0)    parts.push(`${s.watched} watched`);
  if (s.inProgress > 0) parts.push(`${s.inProgress} in progress`);
  if (s.paused > 0)     parts.push(`${s.paused} paused`);
  if (s.dropped > 0)    parts.push(`${s.dropped} dropped`);
  return parts.join(" · ");
}

// ── Hours ─────────────────────────────────────────────────────────────────────

type HoursFilter = "total" | "film" | "serie" | "anime" | "rewatches";

function fmtH(value: number) {
  const h = Math.floor(value);
  const m = Math.round((value - h) * 60);
  return { h, m };
}

function HoursCard({ hours }: { hours: ReturnType<typeof computeStats>["hours"] }) {
  const [filter, setFilter] = useState<HoursFilter>("total");

  const SEGMENTS = [
    { key: "film"      as const, val: hours.film,      color: DONUT_COLORS.film,      label: "Films" },
    { key: "serie"     as const, val: hours.serie,     color: DONUT_COLORS.serie,     label: "Shows" },
    { key: "anime"     as const, val: hours.anime,     color: DONUT_COLORS.anime,     label: "Anime" },
    { key: "rewatches" as const, val: hours.rewatches, color: DONUT_COLORS.rewatches, label: "Rewatches" },
  ];

  const ringTotal = (hours.film + hours.serie + hours.anime + hours.rewatches) || 1;
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
    <div className="rounded-card surface-card p-5 h-60 flex flex-col overflow-hidden">
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

function TopFavoritesCard({ items }: { items: { item: StatsRawItem; seasonLabel: string | null; rating: number | null; seasonPoster: string | null }[] }) {
  const router = useRouter();

  return (
    <div className="rounded-card surface-card p-5">
      <div className="mb-4 flex items-center gap-2">
        <Trophy size={14} className="text-text-tertiary" />
        <p className="text-sm font-semibold text-text-primary">Top Picks</p>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-text-tertiary/50">Rate or favorite items to see your top picks</p>
      ) : (
        <div className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
          {items.map(({ item, seasonLabel, rating, seasonPoster }) => (
            <div
              key={item.id}
              className="group -m-1.5 flex cursor-pointer items-center gap-2.5 rounded-lg p-1.5 transition-colors hover:bg-surface-2"
              onClick={() => router.push(`/perso/watching/${item.id}`)}
            >
              <div className="relative h-14 w-9 shrink-0 overflow-hidden rounded-md">
                {(seasonPoster ? `https://image.tmdb.org/t/p/w300${seasonPoster}` : item.poster_url) ? (
                  <Image
                    src={seasonPoster ? `https://image.tmdb.org/t/p/w300${seasonPoster}` : item.poster_url!}
                    alt={item.title}
                    fill
                    unoptimized
                    className="object-cover"
                    sizes="36px"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-surface-2">
                    <Play size={11} className="text-text-tertiary" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-text-primary">{displayTitle(item)}</p>
                <div className="mt-0.5 flex items-center gap-1.5">
                  {rating != null && (
                    <div className="flex items-center gap-0.5">
                      <Star size={9} className="fill-amber-400 text-amber-400" />
                      <span className="text-[10px] tabular-nums font-medium text-amber-400">{rating}</span>
                    </div>
                  )}
                  {seasonLabel ? (
                    <span className="truncate text-[10px] font-medium" style={{ color: TEAL }}>{seasonLabel}</span>
                  ) : (
                    <span className="text-[10px] text-text-tertiary/50">{item.year}</span>
                  )}
                </div>
              </div>
              {item.favorite && (
                <Heart size={10} className="shrink-0 fill-red-400 text-red-400 opacity-70" />
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
    <div className="rounded-card surface-card p-5 h-60 w-full flex flex-col overflow-hidden">
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

function ActivityCard({ activity, selectedYear }: {
  activity: ReturnType<typeof computeStats>["activity"];
  selectedYear: number | null;
}) {
  const max = Math.max(...activity.map((a) => a.count), 1);
  const best = activity.reduce<{ label: string; count: number } | null>(
    (b, a) => (a.count > (b?.count ?? 0) ? a : b), null);

  return (
    <div className="rounded-card surface-card p-5 h-60 flex flex-col overflow-hidden">
      <div className="mb-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <CalendarDays size={14} className="text-text-tertiary" />
          <p className="text-sm font-semibold text-text-primary">Activity</p>
        </div>
        {best && best.count > 0 && (
          <p className="text-[10px] text-text-tertiary/50 tabular-nums">
            Best: <span className="text-text-tertiary">{best.label}</span> ({best.count})
          </p>
        )}
      </div>

      {activity.length === 0 ? (
        <p className="text-sm text-text-tertiary/50">No activity yet</p>
      ) : (
        <div className="flex flex-1 items-end gap-1 min-h-0">
          {activity.map((a) => {
            const isSel = selectedYear != null && a.label === String(selectedYear);
            return (
              <div key={a.label} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className="w-full rounded-t-sm transition-[height] duration-500"
                  style={{
                    height: a.count > 0 ? `${Math.max(6, (a.count / max) * 130)}px` : 3,
                    backgroundColor: TEAL,
                    opacity: isSel ? 1 : (a.count > 0 ? Math.max(0.25, (a.count / max) * 0.65) : 0.12),
                  }}
                />
                <span className={`text-[9px] tabular-nums leading-none ${isSel ? "font-semibold text-text-secondary" : "text-text-tertiary/70"}`}>{a.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function StatsPage() {
  const router = useRouter();
  const userId = useCurrentUserId();
  const { data, isLoading } = useWatchingStatsData(userId ?? "");
  const rawData = data?.items ?? [];
  const { data: watchingGoals = [] } = useWatchingGoals();
  // Year filter lives in the UI store (not local state) so navigating into a
  // media detail and pressing Back restores the year you were on instead of
  // snapping to the current year. `ready` distinguishes "never set → default to
  // current year" from an explicit "All time" (null) choice.
  const currentYear = new Date().getFullYear();
  const statsYear = useWatchingUIStore((s) => s.statsYear);
  const statsYearReady = useWatchingUIStore((s) => s.statsYearReady);
  const setStatsYear = useWatchingUIStore((s) => s.setStatsYear);
  const selectedYear = statsYearReady ? statsYear : currentYear;
  const [wrappedOpen, setWrappedOpen] = useState(false);

  const stats = useMemo(() => computeStats(data?.items ?? [], data?.rewatches ?? [], selectedYear), [data, selectedYear]);
  const achievements = useMemo(() => computeAchievements(data?.items ?? []), [data]);

  if (!userId || isLoading) return <StatsSkeleton />;

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
          <Button
            variant={selectedYear === null ? "contrast" : "quiet"}
            size="sm"
            onClick={() => setStatsYear(null)}
          >
            All time
          </Button>
          {years.map((year) => (
            <Button
              key={year}
              variant={selectedYear === year ? "contrast" : "quiet"}
              size="sm"
              onClick={() => setStatsYear(year)}
            >
              {year}
            </Button>
          ))}
        </div>

        {/* Mobile: year select */}
        <div className="flex-1 sm:hidden">
          <FilterSelect
            className="w-full"
            value={selectedYear === null ? "all" : String(selectedYear)}
            onChange={(v) => setStatsYear(v === "all" ? null : Number(v))}
            options={[
              { value: "all", label: "All time" },
              ...years.map((y) => ({ value: String(y), label: String(y) })),
            ]}
            aria-label="Stats year"
          />
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Hint label="Export watchlist as CSV">
            <Button variant="quiet" size="sm" onClick={() => exportCSV(rawData.filter((i) => i.watched))}>
              <Download />
              Export
            </Button>
          </Hint>

          {selectedYear && (
            <Button
              variant="quiet"
              size="sm"
              onClick={() => setWrappedOpen(true)}
              className="border-accent-watching-vivid/30 bg-accent-watching-vivid/8 font-semibold text-accent-watching-vivid hover:bg-accent-watching-vivid/15 hover:text-accent-watching-vivid"
            >
              <Sparkles />
              {selectedYear} Wrapped
            </Button>
          )}
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <MetricCard
          label={selectedYear ? "Total watched" : "Total"}
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
          sub={statusSub(stats.statusCounts.serie)}
          icon={<Tv size={14} style={{ color: TEAL }} />}
        />
        <MetricCard
          label="Anime"
          value={stats.counts.anime}
          sub={statusSub(stats.statusCounts.anime)}
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
                  className="group cursor-pointer rounded-card surface-card p-4 text-left transition-colors hover:border-border-default"
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
        <ActivityCard activity={stats.activity} selectedYear={selectedYear} />
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
