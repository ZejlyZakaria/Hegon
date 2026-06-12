"use client";

import { useBooksUIStore } from "../hooks/useBooksUIStore";

function SkeletonBlock({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-surface-2 ${className ?? ""}`} />;
}

const GRID = "grid grid-cols-3 gap-x-4 gap-y-6 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-7";
const ROWS = "grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3";

// ── Stats zone — mirrors the MetricCard grid (plain skeleton theme) ────────────

export function StatsZoneSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="rounded-xl bg-surface-1 p-4">
          <div className="mb-3 flex items-center gap-2">
            <SkeletonBlock className="h-6 w-6 rounded-md" />
            <SkeletonBlock className="h-3.5 w-16" />
          </div>
          <SkeletonBlock className="h-7 w-10" />
        </div>
      ))}
    </div>
  );
}

// ── Grid cover card ───────────────────────────────────────────────────────────

export function BookCardSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <SkeletonBlock className="aspect-2/3 w-full rounded-lg" />
      <SkeletonBlock className="h-3 w-3/4" />
      <SkeletonBlock className="h-2.5 w-1/2" />
    </div>
  );
}

// ── Reading horizontal card ───────────────────────────────────────────────────

export function BookRowSkeleton() {
  return (
    <div className="flex gap-4 rounded-xl bg-surface-1 p-3">
      <SkeletonBlock className="h-28 w-20 shrink-0 rounded-md" />
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
    <div className="flex flex-col gap-3 rounded-xl bg-surface-1 p-4">
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

function PagesMonthSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-xl bg-surface-1 p-4">
      <SkeletonBlock className="h-3 w-28" />
      <div className="flex justify-center">
        <SkeletonBlock className="h-28 w-28 rounded-full" />
      </div>
    </div>
  );
}

function RecentlyFinishedSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-xl bg-surface-1 p-4">
      <SkeletonBlock className="h-3 w-32" />
      {[1, 2].map((i) => (
        <div key={i} className="flex gap-3">
          <SkeletonBlock className="h-14 w-10 shrink-0 rounded" />
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
      <PagesMonthSkeleton />
      <RecentlyFinishedSkeleton />
    </div>
  );
}

// ── Tabs row (New Book button sits on the right) ──────────────────────────────

function TabsRowSkeleton() {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center">
        <SkeletonBlock className="mx-3 h-3.5 w-16" />
        <SkeletonBlock className="mx-3 h-3.5 w-24" />
        <SkeletonBlock className="mx-3 h-3.5 w-20" />
        <SkeletonBlock className="mx-3 h-3.5 w-8" />
      </div>
      <div className="flex items-center gap-2">
        <SkeletonBlock className="h-9 w-48 rounded-md" />
        <SkeletonBlock className="h-9 w-36 rounded-md" />
        <SkeletonBlock className="h-9 w-28 rounded-md" />
      </div>
    </div>
  );
}

// ── Full page — content matches the active tab to avoid a double-skeleton flash ─

export function BooksLoadingSkeleton() {
  const activeTab = useBooksUIStore((s) => s.activeTab);
  const isReading = activeTab === "reading";

  return (
    <div className="space-y-4 px-6 py-6">
      <StatsZoneSkeleton />
      <div className="flex items-start gap-6">
        <div className="min-w-0 flex-1 space-y-4">
          <TabsRowSkeleton />
          {isReading ? (
            <div className={ROWS}>
              {Array.from({ length: 3 }).map((_, i) => <BookRowSkeleton key={i} />)}
            </div>
          ) : (
            <div className={GRID}>
              {Array.from({ length: 14 }).map((_, i) => <BookCardSkeleton key={i} />)}
            </div>
          )}
        </div>
        <div className="w-72 shrink-0 space-y-3">
          <ReadingStreakSkeleton />
          <PagesMonthSkeleton />
          <RecentlyFinishedSkeleton />
        </div>
      </div>
    </div>
  );
}
