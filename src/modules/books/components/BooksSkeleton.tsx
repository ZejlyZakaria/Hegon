"use client";

import { useBooksUIStore } from "../hooks/useBooksUIStore";

function SkeletonBlock({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-surface-2 ${className ?? ""}`} />;
}

const GRID = "grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10";
const ROWS = "grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3";

// ── Grid cover card ───────────────────────────────────────────────────────────

export function BookCardSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <SkeletonBlock className="aspect-2/3 w-full rounded-tile" />
      <SkeletonBlock className="h-3 w-3/4" />
      <SkeletonBlock className="h-2.5 w-1/2" />
    </div>
  );
}

// ── Reading horizontal card ───────────────────────────────────────────────────

export function BookRowSkeleton() {
  return (
    <div className="flex gap-4 surface-card rounded-card p-3">
      <SkeletonBlock className="aspect-2/3 w-(--cover-md) shrink-0 rounded-tile" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <SkeletonBlock className="h-3.5 w-3/4" />
        <SkeletonBlock className="h-3 w-1/2" />
        <div className="mt-auto flex flex-col gap-1.5">
          <SkeletonBlock className="h-3 w-24" />
          <SkeletonBlock className="h-1.5 w-full rounded-full" />
        </div>
      </div>
    </div>
  );
}

// ── Right panel cards ─────────────────────────────────────────────────────────

function ReadingStreakSkeleton() {
  return (
    <div className="flex flex-col gap-3 surface-card rounded-card p-4">
      <div className="flex items-center justify-between">
        <SkeletonBlock className="h-3 w-24" />
        <SkeletonBlock className="h-3 w-12" />
      </div>
      <SkeletonBlock className="h-8 w-16" />
      <div className="flex items-center justify-between">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <SkeletonBlock className="h-2.5 w-4" />
            <SkeletonBlock className="h-2 w-2 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ReadingGoalsSkeleton() {
  return (
    <div className="flex flex-col gap-3 surface-card rounded-card p-4">
      <SkeletonBlock className="h-3 w-24" />
      <div className="flex items-center gap-2.5">
        <SkeletonBlock className="h-7 w-7 shrink-0 rounded-tile" />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <SkeletonBlock className="h-3 w-2/3" />
          <SkeletonBlock className="h-1 w-full rounded-full" />
        </div>
        <SkeletonBlock className="h-3 w-8 shrink-0" />
      </div>
    </div>
  );
}

function PagesMonthSkeleton() {
  return (
    <div className="flex flex-col gap-3 surface-card rounded-card p-4">
      <SkeletonBlock className="h-3 w-28" />
      <div className="flex justify-center">
        <SkeletonBlock className="h-28 w-28 rounded-full" />
      </div>
    </div>
  );
}

function RecentlyFinishedSkeleton() {
  return (
    <div className="flex flex-col gap-3 surface-card rounded-card p-4">
      <SkeletonBlock className="h-3 w-32" />
      {[1, 2].map((i) => (
        <div key={i} className="flex gap-3">
          <SkeletonBlock className="aspect-2/3 w-(--cover-sm) shrink-0 rounded-[4px]" />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <SkeletonBlock className="h-3.5 w-full" />
            <SkeletonBlock className="h-3 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function BooksRightPanelLoadingSkeleton() {
  return (
    <div className="flex w-full flex-col gap-3">
      <ReadingStreakSkeleton />
      <ReadingGoalsSkeleton />
      <PagesMonthSkeleton />
      <RecentlyFinishedSkeleton />
    </div>
  );
}

// ── Tabs row (New Book button sits on the right) ──────────────────────────────

function TabsRowSkeleton() {
  return (
    <div>
      {/* Row 1 — tabs + action (mirrors the real toolbar: tabs scroll, action stays) */}
      <div className="flex items-center gap-x-3">
        <div className="flex min-w-0 items-center overflow-x-auto overflow-y-hidden custom-scrollbar-hide py-2">
          {["w-16", "w-24", "w-20", "w-8", "w-12", "w-16"].map((w, i) => (
            <SkeletonBlock key={i} className={`mx-3 h-3.5 shrink-0 ${w}`} />
          ))}
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2 pb-1.5">
          <div className="hidden items-center gap-2 xl:flex">
            <SkeletonBlock className="h-9 w-48 rounded-control" />
            <SkeletonBlock className="h-9 w-9 rounded-control" />
            <SkeletonBlock className="h-9 w-36 rounded-control" />
          </div>
          <SkeletonBlock className="h-9 w-9 rounded-control sm:w-28" />
        </div>
      </div>
      {/* Row 2 (below xl) — search + filters */}
      <div className="mt-1.5 flex items-center gap-2 pb-2 xl:hidden">
        <SkeletonBlock className="h-9 flex-1 rounded-control" />
        <SkeletonBlock className="h-9 w-9 shrink-0 rounded-control" />
        <SkeletonBlock className="h-9 w-36 shrink-0 rounded-control" />
      </div>
    </div>
  );
}

// ── Full page — content matches the active tab to avoid a double-skeleton flash ─

export function BooksLoadingSkeleton() {
  const activeTab = useBooksUIStore((s) => s.activeTab);
  const isReading = activeTab === "reading";

  return (
    <div>
      {/* Full-width tab rail — flush under the TopBar (matches the real page). */}
      <div className="border-b border-border-subtle px-4 sm:px-6">
        <TabsRowSkeleton />
      </div>
      {/* Content — right panel only on Reading (matches the real page); browse
          tabs are a full-width grid. */}
      <div className="px-4 py-4 sm:px-6 sm:py-6">
        {isReading ? (
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
            <div className="min-w-0 flex-1">
              <div className={ROWS}>
                {Array.from({ length: 3 }).map((_, i) => <BookRowSkeleton key={i} />)}
              </div>
            </div>
            <div className="w-full space-y-3 lg:w-72 lg:shrink-0">
              <ReadingStreakSkeleton />
              <ReadingGoalsSkeleton />
              <PagesMonthSkeleton />
              <RecentlyFinishedSkeleton />
            </div>
          </div>
        ) : (
          <div className={GRID}>
            {Array.from({ length: 21 }).map((_, i) => <BookCardSkeleton key={i} />)}
          </div>
        )}
      </div>
    </div>
  );
}
