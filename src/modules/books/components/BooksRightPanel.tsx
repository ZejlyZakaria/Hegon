"use client";

import { BookOpen, Star, Target } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useBooksRightPanel } from "../hooks/useBooks";
import { useBooksGoals } from "../hooks/useBooksGoals";
import { BooksRightPanelLoadingSkeleton } from "./BooksSkeleton";

const SKY = "var(--color-accent-books-vivid)";
const GOALS = "var(--color-accent-goals)";
const DAYS = ["M", "T", "W", "T", "F", "S", "S"];
const RING_R = 56;
const RING_C = 2 * Math.PI * RING_R;

export function BooksRightPanel() {
  const router = useRouter();
  const { data, isLoading } = useBooksRightPanel();
  const { data: goals = [] } = useBooksGoals();

  if (isLoading) return <BooksRightPanelLoadingSkeleton />;

  if (!data) return null;

  const { streak, pages_this_month, recently_finished, activityLast7 } = data;

  const today = new Date();
  const weekDots = Array.from({ length: 7 }).map((_, i) => {
    const date = new Date(today);
    date.setDate(date.getDate() - (6 - i));
    const dayIndex = date.getDay() === 0 ? 6 : date.getDay() - 1;
    return { label: DAYS[dayIndex], active: activityLast7[i] };
  });

  const ringDash = Math.min(pages_this_month / 300, 1) * RING_C;

  return (
    <div className="w-full flex flex-col gap-3">
      {/* ── Reading Streak — branded hero (deep-accent solid surface, like Goals' Focus) ── */}
      <div
        className="relative overflow-hidden rounded-card p-4 flex flex-col gap-3"
        style={{
          background: "var(--color-accent-books)",
          boxShadow:
            "inset 0 1px 0 0 rgba(255,255,255,0.08), inset 0 0 0 1px rgba(255,255,255,0.06), 0 1px 2px 0 rgba(0,0,0,0.35), 0 10px 30px -12px rgba(0,0,0,0.5)",
        }}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-white/90">Reading Streak</h3>
          <span className="text-xs text-white/55">Best {streak.best}</span>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-3xl font-bold text-white">{streak.current}</span>
          <span className="text-sm text-white/70">days</span>
        </div>
        <div className="flex items-center justify-between">
          {weekDots.map((dot, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <span className="text-[10px] text-white/45">{dot.label}</span>
              <div
                className="h-2 w-2 rounded-full"
                style={{
                  backgroundColor: dot.active ? SKY : "rgba(255,255,255,0.15)",
                  boxShadow: dot.active ? `0 0 6px ${SKY}` : undefined,
                }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* ── Reading Goals (cross-module — Goals accent) ── */}
      {goals.length > 0 && (
        <div className="surface-card rounded-card p-4 flex flex-col gap-3">
          <h3 className="text-xs font-semibold text-text-secondary">Reading Goals</h3>
          <div className="flex flex-col gap-2.5">
            {goals.map((g) => {
              const target = g.metric_target ?? 0;
              const count  = g.metric_current;
              const pct    = target > 0 ? Math.min(100, (count / target) * 100) : g.progress;
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => router.push(`/life/goals/${g.id}`)}
                  className="group flex w-full items-center gap-2.5 text-left"
                >
                  <div
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-tile"
                    style={{ backgroundColor: `color-mix(in srgb, ${GOALS} 16%, transparent)`, color: GOALS }}
                  >
                    <Target size={13} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-text-primary group-hover:text-white transition-colors">
                      {g.title}
                    </p>
                    <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-surface-2">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: GOALS }} />
                    </div>
                  </div>
                  <span className="shrink-0 text-[11px] tabular-nums text-text-tertiary">{count}/{target}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Pages This Month ── */}
      <div className="surface-card rounded-card p-4 flex flex-col gap-3">
        <h3 className="text-xs font-semibold text-text-secondary">Pages This Month</h3>
        <div className="flex items-center justify-center">
          <div className="relative w-28 h-28">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 128 128" style={{ color: SKY }}>
              <circle cx="64" cy="64" r={RING_R} fill="none" stroke="var(--color-surface-3)" strokeWidth="8" />
              <circle
                cx="64" cy="64" r={RING_R}
                fill="none"
                stroke="currentColor"
                strokeWidth="8"
                strokeDasharray={`${ringDash} ${RING_C}`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-bold text-text-primary">{pages_this_month}</span>
              <span className="text-[10px] text-text-tertiary">pages</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Recently Finished ── */}
      <div className="surface-card rounded-card p-4 flex flex-col gap-3">
        <h3 className="text-xs font-semibold text-text-secondary">Recently Finished</h3>
        {recently_finished.length === 0 ? (
          <p className="text-xs text-text-tertiary">No books finished yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {recently_finished.map((book) => (
              <div key={book.id} className="flex gap-3">
                <div className="relative aspect-2/3 w-(--cover-sm) shrink-0 bg-surface-2 rounded-[4px] overflow-hidden">
                  {book.cover_url ? (
                    <Image src={book.cover_url} alt={book.title} fill sizes="40px" className="object-contain" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <BookOpen className="w-4 h-4 text-text-tertiary" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0 flex flex-col gap-1">
                  <p className="text-sm font-medium text-text-primary truncate">{book.title}</p>
                  {book.rating != null && (
                    <div className="flex items-center gap-0.5" style={{ color: SKY }}>
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className="w-3 h-3"
                          fill={i < book.rating! ? "currentColor" : "none"}
                          stroke={i < book.rating! ? "currentColor" : "var(--color-text-tertiary)"}
                          strokeWidth={1.5}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
