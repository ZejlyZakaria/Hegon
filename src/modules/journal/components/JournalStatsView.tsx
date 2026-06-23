"use client";

import { useMemo } from "react";
import { FileText, Flame, AlignLeft, CalendarCheck, Gauge, Smile, CalendarDays, Hash } from "lucide-react";
import { FadeIn } from "@/shared/components/ui/motion";
import { MetricCard } from "@/shared/components/stats/MetricCard";
import { useJournalEntries } from "../hooks/useJournalEntry";
import { useJournalStreak } from "../hooks/useJournalCalendar";
import { computeJournalStats } from "../lib/compute-stats";
import { MOOD_CONFIG } from "../types";

const ACCENT = "var(--color-accent-journal-vivid)";
const FIRE = "var(--color-fire)";

function ChartCard({
  icon,
  title,
  meta,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  meta?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-60 flex-col overflow-hidden rounded-card surface-card p-5">
      <div className="mb-3 flex shrink-0 items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-text-tertiary">{icon}</span>
          <p className="text-sm font-semibold text-text-primary">{title}</p>
        </div>
        {meta && <span className="text-[11px] text-text-tertiary">{meta}</span>}
      </div>
      {children}
    </div>
  );
}

function StatsSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-24 rounded-card bg-surface-2" />)}
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {[1, 2, 3].map((i) => <div key={i} className="h-60 rounded-card bg-surface-2" />)}
      </div>
    </div>
  );
}

export function JournalStatsView() {
  const { data: entries = [], isLoading } = useJournalEntries();
  const { data: streak } = useJournalStreak();

  const stats = useMemo(() => computeJournalStats(entries), [entries]);

  if (isLoading) return <StatsSkeleton />;

  const maxMood = Math.max(...stats.moodDistribution.map((m) => m.count), 1);
  const maxMonth = Math.max(...stats.monthly.map((m) => m.count), 1);
  const maxTag = stats.topTags[0]?.count ?? 1;
  const currentMonth = new Date().getMonth();
  const year = new Date().getFullYear();

  return (
    <FadeIn className="space-y-4">
      {/* Metric strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <MetricCard label="Entries" value={stats.totalEntries} icon={<FileText size={14} style={{ color: ACCENT }} />} />
        <MetricCard label="Current streak" value={`${streak?.current ?? 0}d`} icon={<Flame size={14} style={{ color: FIRE }} />} />
        <MetricCard label="Words written" value={stats.totalWords.toLocaleString()} icon={<AlignLeft size={14} style={{ color: ACCENT }} />} />
        <MetricCard label="Active days" value={stats.activeDays} icon={<CalendarCheck size={14} style={{ color: ACCENT }} />} />
        <MetricCard label="Avg words" value={stats.avgWords} sub="per entry" icon={<Gauge size={14} style={{ color: ACCENT }} />} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {/* Mood distribution */}
        <ChartCard icon={<Smile size={14} />} title="Mood">
          {stats.moodDistribution.every((m) => m.count === 0) ? (
            <p className="text-sm text-text-tertiary/50">No moods logged yet</p>
          ) : (
            <div className="flex min-h-0 flex-1 items-end justify-around gap-3">
              {stats.moodDistribution.map((m) => (
                <div key={m.mood} className="flex flex-1 flex-col items-center gap-1.5">
                  <span className="text-[10px] tabular-nums text-text-tertiary">{m.count}</span>
                  <div
                    className="w-full max-w-9 rounded-chip transition-[height] duration-500"
                    style={{
                      height: m.count > 0 ? `${Math.max((m.count / maxMood) * 130, 4)}px` : 2,
                      backgroundColor: MOOD_CONFIG[m.mood].color,
                      opacity: m.count > 0 ? Math.max(0.35, m.count / maxMood) : 0.15,
                    }}
                  />
                  <span className="text-[9px] capitalize text-text-tertiary">{m.mood}</span>
                </div>
              ))}
            </div>
          )}
        </ChartCard>

        {/* Monthly activity */}
        <ChartCard icon={<CalendarDays size={14} />} title="Monthly activity" meta={String(year)}>
          <div className="flex min-h-0 flex-1 items-end gap-1.5">
            {stats.monthly.map((m, i) => {
              const isFuture = i > currentMonth;
              const h = m.count > 0 ? Math.max((m.count / maxMonth) * 100, 8) : 0;
              return (
                <div key={m.label} className="group flex flex-1 flex-col">
                  <div className="relative flex w-full flex-1 items-end overflow-hidden rounded-chip"
                    style={{ backgroundColor: `color-mix(in srgb, var(--color-surface-2) ${isFuture ? 28 : 55}%, transparent)` }}>
                    {m.count > 0 && (
                      <div className="w-full rounded-chip" style={{ height: `${h}%`, backgroundColor: ACCENT, opacity: Math.max(0.4, m.count / maxMonth) }} />
                    )}
                  </div>
                  <span className="mt-2 text-center text-[10px] tabular-nums text-text-tertiary">{m.label[0]}</span>
                </div>
              );
            })}
          </div>
        </ChartCard>

        {/* Top tags */}
        <ChartCard icon={<Hash size={14} />} title="Top tags">
          {stats.topTags.length === 0 ? (
            <p className="text-sm text-text-tertiary/50">No tags yet</p>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col justify-center gap-2.5 overflow-hidden">
              {stats.topTags.map((t, i) => (
                <div key={t.name} className="flex items-center gap-3">
                  <span className="w-20 shrink-0 truncate text-xs text-text-secondary">#{t.name}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                    <div className="h-full rounded-full" style={{ width: `${(t.count / maxTag) * 100}%`, backgroundColor: ACCENT, opacity: Math.max(0.4, 1 - i * 0.12) }} />
                  </div>
                  <span className="w-5 shrink-0 text-right text-xs tabular-nums text-text-tertiary">{t.count}</span>
                </div>
              ))}
            </div>
          )}
        </ChartCard>
      </div>
    </FadeIn>
  );
}
