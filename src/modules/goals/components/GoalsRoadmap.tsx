"use client";

import { useMemo } from "react";
import Link from "next/link";
import { cn } from "@/shared/utils/utils";
import { FadeIn, StaggerList, StaggerItem } from "@/shared/components/ui/motion";
import { CATEGORY_COLOR, isGoalOverdue } from "../constants";
import type { Goal, GoalCategory } from "../types";

const colorOf = (c: GoalCategory | null) => CATEGORY_COLOR[c ?? "other"];

const LABEL_W = "13rem"; // keep in sync with the track offset

function monthLabel(d: Date) {
  const m = d.toLocaleDateString("en-GB", { month: "short" });
  return d.getMonth() === 0 ? `${m} '${String(d.getFullYear()).slice(2)}` : m;
}

// ─── Desktop roadmap ────────────────────────────────────────────────────────────

function Roadmap({ goals }: { goals: Goal[] }) {
  const { dated, undated, months, pct, todayLeft } = useMemo(() => {
    const now = new Date();
    const windowStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const cap = new Date(now.getFullYear(), now.getMonth() + 12, 1); // never span more than ~12 months

    const dated = goals.filter((g) => g.target_date);
    const undated = goals.filter((g) => !g.target_date);

    let maxEnd = new Date(now.getFullYear(), now.getMonth() + 3, 1);
    for (const g of dated) {
      const d = new Date(g.target_date!);
      if (d > maxEnd) maxEnd = d;
    }
    if (maxEnd > cap) maxEnd = cap;
    const windowEnd = new Date(maxEnd.getFullYear(), maxEnd.getMonth() + 1, 1);
    const span = windowEnd.getTime() - windowStart.getTime();

    const pct = (d: Date) => Math.max(0, Math.min(100, ((d.getTime() - windowStart.getTime()) / span) * 100));

    const months: { label: string; left: number }[] = [];
    let m = new Date(windowStart);
    while (m < windowEnd) {
      months.push({ label: monthLabel(m), left: pct(m) });
      m = new Date(m.getFullYear(), m.getMonth() + 1, 1);
    }

    return { dated, undated, months, pct, todayLeft: pct(now) };
  }, [goals]);

  if (goals.length === 0) {
    return <p className="py-16 text-center text-sm text-text-tertiary">No goals to place on the timeline.</p>;
  }

  return (
    <FadeIn className="surface-card rounded-card p-4">
      {/* Month axis */}
      <div className="flex">
        <div className="shrink-0" style={{ width: LABEL_W }} />
        <div className="relative h-5 flex-1">
          {months.map((mo, i) => (
            <span
              key={i}
              className="absolute top-0 -translate-x-1/2 text-[10px] font-medium text-text-tertiary"
              style={{ left: `${mo.left}%` }}
            >
              {mo.label}
            </span>
          ))}
        </div>
      </div>

      {/* Body — gridlines + today line as an overlay aligned to the track area */}
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 right-0" style={{ left: LABEL_W }}>
          {months.map((mo, i) => (
            <div key={i} className="absolute inset-y-0 w-px bg-border-subtle/50" style={{ left: `${mo.left}%` }} />
          ))}
          <div className="absolute inset-y-0 w-px" style={{ left: `${todayLeft}%`, backgroundColor: "var(--color-accent-goals)" }}>
            <span className="absolute -top-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full" style={{ backgroundColor: "var(--color-accent-goals)" }} />
          </div>
        </div>

        <StaggerList className="relative space-y-1.5 py-2">
          {dated.length === 0 ? (
            <p className="py-8 text-center text-xs text-text-tertiary">No dated goals yet — add a target date to see them here.</p>
          ) : (
            dated.map((g, gi) => {
              const start = new Date(g.started_at);
              const end = new Date(g.target_date!);
              const left = pct(start);
              const width = Math.max(2, pct(end) - left);
              const overdue = isGoalOverdue(g);
              const done = g.status === "completed";
              const color = colorOf(g.category);
              const milestones = (g.milestones ?? []).filter((m) => m.due_date);

              return (
                <StaggerItem key={g.id} index={gi}>
                <Link
                  href={`/life/goals/${g.id}`}
                  className={cn("group flex items-center rounded-tile py-1 transition-colors hover:bg-surface-2", done && "opacity-50")}
                >
                  {/* Label */}
                  <div className="flex shrink-0 items-center gap-1.5 pr-3" style={{ width: LABEL_W }}>
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                    <span className="truncate text-xs font-medium text-text-secondary group-hover:text-text-primary">{g.title}</span>
                  </div>

                  {/* Track */}
                  <div className="relative h-6 flex-1">
                    <div
                      className="absolute top-1/2 flex h-3.5 -translate-y-1/2 items-center overflow-hidden rounded-full"
                      style={{ left: `${left}%`, width: `${width}%`, backgroundColor: color + "33", boxShadow: overdue ? "0 0 0 1px #f8717188" : undefined }}
                    >
                      {/* progress fill */}
                      <div className="h-full rounded-full" style={{ width: `${g.progress}%`, backgroundColor: color }} />
                    </div>

                    {/* Milestone dots */}
                    {milestones.map((m) => {
                      const x = pct(new Date(m.due_date!));
                      const reached = m.status === "completed";
                      return (
                        <span
                          key={m.id}
                          title={m.title}
                          className="absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border"
                          style={{
                            left: `${x}%`,
                            backgroundColor: reached ? color : "var(--color-surface-1)",
                            borderColor: color,
                          }}
                        />
                      );
                    })}

                    {/* End marker — sits after the bar, but flips to the left of the
                        bar end when it's too close to the right edge (no wrap/overflow). */}
                    {(() => {
                      const endPct = Math.min(100, left + width);
                      const nearRight = endPct > 86;
                      return (
                        <span
                          className={cn("absolute top-1/2 -translate-y-1/2 whitespace-nowrap text-[9px] tabular-nums", overdue ? "text-red-400" : "text-text-tertiary")}
                          style={nearRight
                            ? { right: `calc(${100 - endPct}% + 4px)` }
                            : { left: `calc(${endPct}% + 4px)` }}
                        >
                          {end.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                        </span>
                      );
                    })()}
                  </div>
                </Link>
                </StaggerItem>
              );
            })
          )}
        </StaggerList>
      </div>

      {/* No-deadline shelf */}
      {undated.length > 0 && (
        <div className="mt-3 border-t border-border-subtle pt-3">
          <p className="mb-2 text-xs font-semibold text-text-secondary">No deadline</p>
          <div className="flex flex-wrap gap-2">
            {undated.map((g) => (
              <Link
                key={g.id}
                href={`/life/goals/${g.id}`}
                className="flex items-center gap-1.5 rounded-full border border-border-subtle bg-surface-2 px-2.5 py-1 text-xs text-text-secondary transition-colors hover:text-text-primary"
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: colorOf(g.category) }} />
                <span className="max-w-40 truncate">{g.title}</span>
                <span className="text-text-tertiary tabular-nums">{g.progress}%</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </FadeIn>
  );
}

// ─── Mobile fallback — vertical buckets ──────────────────────────────────────────

const BUCKETS = [
  { key: "overdue", label: "Overdue" },
  { key: "month",   label: "This month" },
  { key: "quarter", label: "Next 3 months" },
  { key: "later",   label: "Later" },
  { key: "someday", label: "Someday" },
] as const;

function bucketOf(g: Goal): (typeof BUCKETS)[number]["key"] {
  if (!g.target_date) return "someday";
  const now = new Date();
  const d = new Date(g.target_date);
  if (isGoalOverdue(g)) return "overdue";
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  if (d <= endOfMonth) return "month";
  const in3mo = new Date(now.getFullYear(), now.getMonth() + 3, now.getDate());
  if (d <= in3mo) return "quarter";
  return "later";
}

function MobileBuckets({ goals }: { goals: Goal[] }) {
  const grouped = useMemo(() => {
    const map = new Map<string, Goal[]>();
    for (const g of goals) {
      const k = bucketOf(g);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(g);
    }
    return map;
  }, [goals]);

  return (
    <div className="space-y-5">
      {BUCKETS.map((b) => {
        const items = grouped.get(b.key);
        if (!items || items.length === 0) return null;
        return (
          <div key={b.key}>
            <p className={cn("mb-2 text-xs font-semibold", b.key === "overdue" ? "text-red-400" : "text-text-secondary")}>
              {b.label}
            </p>
            <StaggerList className="space-y-1.5">
              {items.map((g, i) => (
                <StaggerItem key={g.id} index={i}>
                  <Link
                    href={`/life/goals/${g.id}`}
                    className="surface-card flex items-center gap-2 rounded-card p-2.5 transition-transform duration-200 ease-out hover:scale-[1.01]"
                  >
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: colorOf(g.category) }} />
                    <span className="min-w-0 flex-1 truncate text-sm text-text-primary">{g.title}</span>
                    <span className="shrink-0 text-xs tabular-nums text-text-tertiary">{g.progress}%</span>
                    {g.target_date && (
                      <span className="shrink-0 text-[10px] text-text-tertiary">
                        {new Date(g.target_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                      </span>
                    )}
                  </Link>
                </StaggerItem>
              ))}
            </StaggerList>
          </div>
        );
      })}
    </div>
  );
}

// ─── Public ──────────────────────────────────────────────────────────────────────

export function GoalsRoadmap({ goals }: { goals: Goal[] }) {
  const active = goals.filter((g) => g.status !== "abandoned");
  return (
    <>
      <div className="hidden lg:block">
        <Roadmap goals={active} />
      </div>
      <div className="lg:hidden">
        <MobileBuckets goals={active} />
      </div>
    </>
  );
}
