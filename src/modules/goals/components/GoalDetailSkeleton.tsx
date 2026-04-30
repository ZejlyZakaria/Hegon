function SkeletonBlock({ className }: { className?: string }) {
  return <div className={`rounded bg-surface-2 animate-pulse ${className ?? ""}`} />;
}

function HeroCardSkeleton() {
  return (
    <div className="rounded-lg border border-border-subtle bg-surface-1 p-3">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <SkeletonBlock className="h-5 w-56" />
            <SkeletonBlock className="h-4 w-16 rounded-full" />
          </div>
          <SkeletonBlock className="h-3.5 w-3/4" />
        </div>
        <SkeletonBlock className="h-8 w-8 rounded-md shrink-0" />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <SkeletonBlock className="h-3 w-14" />
          <SkeletonBlock className="h-3 w-8" />
        </div>
        <SkeletonBlock className="h-1.5 w-full rounded-full" />
        <SkeletonBlock className="h-3 w-32" />
      </div>
    </div>
  );
}

function MilestonesCardSkeleton() {
  return (
    <div className="rounded-lg border border-border-subtle bg-surface-1 p-4 space-y-3">
      <SkeletonBlock className="h-3 w-20" />
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-3">
          <SkeletonBlock className="h-4 w-4 rounded-sm shrink-0" />
          <SkeletonBlock className="h-3 flex-1" />
          <SkeletonBlock className="h-3 w-16 shrink-0" />
        </div>
      ))}
    </div>
  );
}

function LinkedTasksCardSkeleton() {
  return (
    <div className="rounded-lg border border-border-subtle bg-surface-1 p-4 space-y-3">
      <SkeletonBlock className="h-3 w-28" />
      {[1, 2].map((i) => (
        <div key={i} className="flex items-center gap-3 rounded-lg border border-border-subtle bg-surface-1 px-3 py-2">
          <SkeletonBlock className="h-1.5 w-1.5 rounded-full shrink-0" />
          <SkeletonBlock className="h-3 flex-1" />
          <SkeletonBlock className="h-3 w-14 shrink-0" />
        </div>
      ))}
    </div>
  );
}

function ProgressControlSkeleton() {
  return (
    <div className="rounded-lg border border-border-subtle bg-surface-1 p-4 space-y-4">
      <SkeletonBlock className="h-3 w-28" />
      <SkeletonBlock className="h-8 w-full rounded-md" />
      <div className="flex justify-center py-1">
        <SkeletonBlock className="h-10 w-20" />
      </div>
      <SkeletonBlock className="h-2 w-full rounded-full" />
      <SkeletonBlock className="h-3 w-32 mx-auto" />
    </div>
  );
}

function GoalInfoSkeleton() {
  return (
    <div className="rounded-lg border border-border-subtle bg-surface-1 p-4 space-y-3">
      <SkeletonBlock className="h-3 w-16" />
      <SkeletonBlock className="h-8 w-full rounded-lg" />
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-center justify-between">
          <SkeletonBlock className="h-3 w-14" />
          <SkeletonBlock className="h-3 w-20" />
        </div>
      ))}
    </div>
  );
}

function StatsSkeleton() {
  return (
    <div className="rounded-lg border border-border-subtle bg-surface-1 p-3 space-y-3">
      <SkeletonBlock className="h-3 w-10" />
      <div className="grid grid-cols-2 gap-2">
        {[1, 2].map((i) => (
          <div key={i} className="rounded-md bg-surface-2 px-3 py-2 space-y-1.5 text-center">
            <SkeletonBlock className="h-6 w-8 mx-auto" />
            <SkeletonBlock className="h-3 w-10 mx-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function MilestoneListSkeleton() {
  return <div className="h-9 rounded-lg bg-surface-2 animate-pulse" />;
}

export function GoalDetailSkeleton() {
  return (
    <div className="w-full px-6 py-4">
      {/* Back button */}
      <div className="mb-4 flex items-center gap-2">
        <SkeletonBlock className="h-3.5 w-3.5" />
        <SkeletonBlock className="h-3.5 w-10" />
      </div>

      <div className="flex gap-6 items-start">
        {/* Left column */}
        <div className="flex-1 min-w-0 space-y-4">
          <HeroCardSkeleton />
          <MilestonesCardSkeleton />
          <LinkedTasksCardSkeleton />
        </div>

        {/* Right column */}
        <div className="w-72 shrink-0 space-y-3">
          <ProgressControlSkeleton />
          <GoalInfoSkeleton />
          <StatsSkeleton />
        </div>
      </div>
    </div>
  );
}
