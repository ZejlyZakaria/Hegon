function SkeletonBlock({ className }: { className?: string }) {
  return <div className={`rounded bg-surface-2 animate-pulse ${className ?? ""}`} />;
}

function TodayProgressSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-border-subtle bg-surface-1">
      <div className="flex items-stretch">
        <div className="flex-1 px-4 py-3 space-y-2">
          <SkeletonBlock className="h-3.5 w-28" />
          <div className="flex items-center gap-3">
            <SkeletonBlock className="h-2 w-1/2 rounded-full" />
            <SkeletonBlock className="h-7 w-12" />
            <SkeletonBlock className="h-3 w-32" />
          </div>
        </div>
        <div className="my-3 w-px bg-surface-2" />
        <div className="flex w-44 items-center gap-2.5 px-4">
          <SkeletonBlock className="h-4 w-4 shrink-0 rounded" />
          <SkeletonBlock className="h-3 w-24" />
        </div>
      </div>
    </div>
  );
}

function HabitCardSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border-subtle bg-surface-1 p-3">
      <SkeletonBlock className="h-9 w-9 rounded-lg shrink-0" />
      <div className="flex-1 min-w-0 space-y-1.5">
        <SkeletonBlock className="h-3.5 w-40" />
        <SkeletonBlock className="h-3 w-24" />
        <SkeletonBlock className="h-2.5 w-16" />
      </div>
      <div className="flex flex-col items-center gap-1 w-20 border-l border-border-default pl-3">
        <SkeletonBlock className="h-3 w-12" />
        <SkeletonBlock className="h-5 w-6" />
        <SkeletonBlock className="h-2.5 w-10" />
      </div>
      <SkeletonBlock className="h-8 w-20 rounded-md shrink-0" />
    </div>
  );
}

function TabsRowSkeleton() {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1">
        <SkeletonBlock className="h-3.5 w-12 mx-3" />
        <SkeletonBlock className="h-3.5 w-20 mx-3" />
        <SkeletonBlock className="h-3.5 w-20 mx-3" />
      </div>
      <SkeletonBlock className="h-9 w-48 rounded-md" />
    </div>
  );
}

function HabitStreakSkeleton() {
  return (
    <div className="bg-surface-1 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <SkeletonBlock className="h-3 w-20" />
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

function ThisMonthSkeleton() {
  return (
    <div className="bg-surface-1 rounded-lg p-4 space-y-3">
      <SkeletonBlock className="h-3 w-20" />
      <div className="flex justify-center">
        <SkeletonBlock className="h-24 w-24 rounded-full" />
      </div>
      <SkeletonBlock className="h-3 w-24 mx-auto" />
    </div>
  );
}

function CompactHeatmapSkeleton() {
  return (
    <div className="bg-surface-1 rounded-lg p-4 space-y-3">
      <SkeletonBlock className="h-3 w-32" />
      <SkeletonBlock className="h-24 w-full rounded-md" />
    </div>
  );
}

export function AllHabitsHeatmapSkeleton() {
  return (
    <div
      className="animate-pulse rounded-lg border p-4"
      style={{
        backgroundColor: "var(--color-surface-1)",
        borderColor: "var(--color-border-subtle)",
        height: 220,
      }}
    />
  );
}

export function HabitsLoadingSkeleton() {
  return (
    <div className="px-6 py-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1.5">
          <SkeletonBlock className="h-5 w-20" />
          <SkeletonBlock className="h-3.5 w-52" />
        </div>
        <SkeletonBlock className="h-8 w-24 rounded-md shrink-0" />
      </div>

      {/* TodayProgress */}
      <TodayProgressSkeleton />

      {/* Main layout */}
      <div className="flex gap-6 items-start">
        {/* Left column */}
        <div className="flex-1 min-w-0 space-y-3">
          <TabsRowSkeleton />
          {[1, 2, 3, 4].map((i) => (
            <HabitCardSkeleton key={i} />
          ))}
        </div>

        {/* Right column */}
        <div className="w-72 shrink-0 space-y-3">
          <HabitStreakSkeleton />
          <ThisMonthSkeleton />
          <CompactHeatmapSkeleton />
        </div>
      </div>
    </div>
  );
}
