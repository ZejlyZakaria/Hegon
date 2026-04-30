function SkeletonBlock({ className }: { className?: string }) {
  return <div className={`rounded bg-surface-2 animate-pulse ${className ?? ""}`} />;
}

export function StatsZoneSkeleton() {
  return (
    <div className="flex items-stretch gap-3 py-3">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="flex-1 flex items-center gap-3 bg-surface-1 rounded-lg p-3 border border-border-subtle"
        >
          <SkeletonBlock className="w-8 h-8 rounded-md shrink-0" />
          <div className="flex flex-col gap-1.5 min-w-0">
            <SkeletonBlock className="h-6 w-8" />
            <SkeletonBlock className="h-3 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

function TabsRowSkeleton() {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center">
        <SkeletonBlock className="h-3.5 w-16 mx-3" />
        <SkeletonBlock className="h-3.5 w-24 mx-3" />
        <SkeletonBlock className="h-3.5 w-20 mx-3" />
        <SkeletonBlock className="h-3.5 w-8 mx-3" />
      </div>
      <div className="flex items-center gap-2">
        <SkeletonBlock className="h-9 w-48 rounded-md" />
        <SkeletonBlock className="h-9 w-36 rounded-md" />
      </div>
    </div>
  );
}

export function BookCardSkeleton() {
  return (
    <div className="bg-surface-1 rounded-lg border border-border-subtle p-3 flex gap-3">
      <SkeletonBlock className="w-12 h-16 rounded shrink-0" />
      <div className="flex-1 min-w-0 space-y-2">
        <SkeletonBlock className="h-3.5 w-3/4" />
        <SkeletonBlock className="h-3 w-1/2" />
        <SkeletonBlock className="h-2.5 w-16 mt-1" />
        <SkeletonBlock className="h-1.5 w-full rounded-full" />
      </div>
    </div>
  );
}

function ReadingStreakSkeleton() {
  return (
    <div className="bg-surface-1 rounded-lg p-4 space-y-3">
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
    <div className="bg-surface-1 rounded-lg p-4 space-y-3">
      <SkeletonBlock className="h-3 w-28" />
      <div className="flex justify-center">
        <SkeletonBlock className="h-28 w-28 rounded-full" />
      </div>
    </div>
  );
}

function RecentlyFinishedSkeleton() {
  return (
    <div className="bg-surface-1 rounded-lg p-4 space-y-3">
      <SkeletonBlock className="h-3 w-32" />
      {[1, 2].map((i) => (
        <div key={i} className="flex gap-3">
          <SkeletonBlock className="w-10 h-14 rounded shrink-0" />
          <div className="flex-1 min-w-0 space-y-1.5">
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
    <div className="w-full flex flex-col gap-3">
      <ReadingStreakSkeleton />
      <PagesMonthSkeleton />
      <RecentlyFinishedSkeleton />
    </div>
  );
}

export function BooksLoadingSkeleton() {
  return (
    <div className="px-6 py-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1.5">
          <SkeletonBlock className="h-5 w-16" />
          <SkeletonBlock className="h-3.5 w-44" />
        </div>
        <SkeletonBlock className="h-8 w-24 rounded-md shrink-0" />
      </div>

      {/* Stats zone */}
      <StatsZoneSkeleton />

      {/* Main layout */}
      <div className="flex gap-6 items-start">
        {/* Left column */}
        <div className="flex-1 min-w-0 space-y-4">
          <TabsRowSkeleton />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <BookCardSkeleton key={i} />
            ))}
          </div>
        </div>

        {/* Right column */}
        <div className="w-72 shrink-0 space-y-3">
          <ReadingStreakSkeleton />
          <PagesMonthSkeleton />
          <RecentlyFinishedSkeleton />
        </div>
      </div>
    </div>
  );
}
