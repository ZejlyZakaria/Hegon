function SkeletonBlock({ className }: { className?: string }) {
  return <div className={`rounded bg-surface-2 animate-pulse ${className ?? ""}`} />;
}

function RailSkeleton() {
  return (
    <div className="flex flex-col items-center gap-4 rounded-lg border border-border-subtle bg-surface-1 p-4">
      <SkeletonBlock className="h-40 w-40 rounded-full" />
      <div className="flex gap-2.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonBlock key={i} className="h-6 w-6 rounded-full" />
        ))}
      </div>
      <SkeletonBlock className="h-2 w-full rounded-full" />
      <div className="flex w-full items-center gap-4 pt-2">
        <SkeletonBlock className="h-16 w-16 shrink-0 rounded-full" />
        <div className="flex-1 space-y-2">
          <SkeletonBlock className="h-6 w-20" />
          <SkeletonBlock className="h-3 w-16" />
        </div>
      </div>
    </div>
  );
}

function HabitRowSkeleton() {
  return (
    <div className="flex h-14 items-center gap-3 rounded-lg border border-border-subtle bg-surface-1 px-3">
      <SkeletonBlock className="h-5 w-5 rounded-full shrink-0" />
      <SkeletonBlock className="h-8 w-8 rounded-lg shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <SkeletonBlock className="h-3.5 w-40" />
          <SkeletonBlock className="hidden h-3 w-10 shrink-0 sm:block" />
        </div>
        <SkeletonBlock className="h-2.5 w-24" />
      </div>
      <SkeletonBlock className="hidden h-3 w-32 shrink-0 md:block" />
      <SkeletonBlock className="h-3.5 w-12 shrink-0" />
      <span className="w-7 shrink-0" />
    </div>
  );
}

function TabsRowSkeleton() {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-1">
        <SkeletonBlock className="h-3.5 w-12 mx-3" />
        <SkeletonBlock className="h-3.5 w-20 mx-3" />
        <SkeletonBlock className="h-3.5 w-20 mx-3" />
      </div>
      <SkeletonBlock className="h-9 w-full rounded-md sm:w-48" />
    </div>
  );
}

function ThisWeekSkeleton() {
  return (
    <div className="bg-surface-1 rounded-lg p-4 flex flex-col gap-3">
      <SkeletonBlock className="h-3 w-20" />
      <div className="flex items-center justify-between">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-1.5">
            <SkeletonBlock className="h-2 w-4" />
            <SkeletonBlock className="h-2.5 w-2.5 rounded-full" />
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

export function StatsSkeleton() {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.35fr_1fr]">
        <SkeletonBlock className="h-44 w-full rounded-2xl" />
        <SkeletonBlock className="h-44 w-full rounded-2xl" />
      </div>
      <SkeletonBlock className="h-56 w-full rounded-2xl" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <SkeletonBlock key={i} className="h-28 w-full rounded-2xl" />
        ))}
      </div>
      <SkeletonBlock className="h-56 w-full rounded-2xl" />
    </div>
  );
}

export function HabitsLoadingSkeleton() {
  return (
    <div className="px-4 py-4 sm:px-6 sm:py-6">
      {/* Main layout: rail + center + right */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        {/* Rail */}
        <div className="hidden lg:block w-56 shrink-0">
          <RailSkeleton />
        </div>

        {/* Center column */}
        <div className="flex-1 min-w-0 space-y-3">
          <TabsRowSkeleton />
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <HabitRowSkeleton key={i} />
            ))}
          </div>
        </div>

        {/* Right column */}
        <div className="w-full lg:w-72 lg:shrink-0 space-y-3">
          <ThisWeekSkeleton />
          <ThisMonthSkeleton />
          <CompactHeatmapSkeleton />
        </div>
      </div>
    </div>
  );
}
