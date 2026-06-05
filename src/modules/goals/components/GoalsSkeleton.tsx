function GoalCardSkeleton() {
  return (
    <div className="rounded-lg border border-border-subtle p-3 bg-surface-1">
      <div className="flex flex-col gap-2.5 lg:grid lg:grid-cols-[minmax(0,1fr)_240px_120px_44px] lg:items-center lg:gap-4">
        <div className="space-y-2">
          <div className="h-2 w-14 rounded-full bg-surface-2 animate-pulse" />
          <div className="h-3.5 w-3/4 rounded bg-surface-2 animate-pulse" />
          <div className="h-3 w-1/2 rounded bg-surface-2 animate-pulse" />
        </div>
        <div className="w-full space-y-2 lg:w-60">
          <div className="h-3 w-8 rounded bg-surface-2 animate-pulse" />
          <div className="h-1 w-full rounded-full bg-surface-2 animate-pulse" />
        </div>
        <div className="flex items-center justify-between gap-3 lg:block lg:space-y-2">
          <div className="h-3 w-14 rounded bg-surface-2 animate-pulse" />
          <div className="h-3 w-16 rounded bg-surface-2 animate-pulse" />
        </div>
        <div className="hidden justify-end lg:flex">
          <div className="h-4 w-4 rounded bg-surface-2 animate-pulse" />
        </div>
      </div>
    </div>
  );
}

function GoalTabsRowSkeleton() {
  return (
    <div className="flex flex-col gap-2 pb-1 sm:flex-row sm:items-center sm:justify-between">
      {/* Tabs */}
      <div className="flex items-center gap-1">
        {[40, 52, 72].map((w, i) => (
          <div
            key={i}
            className="h-5 rounded bg-surface-2 animate-pulse mx-3"
            style={{ width: w }}
          />
        ))}
      </div>
      {/* Filters */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="h-9 w-full rounded-lg bg-surface-2 animate-pulse sm:w-48" />
        <div className="flex gap-2">
          <div className="h-9 flex-1 rounded-lg bg-surface-2 animate-pulse sm:w-36 sm:flex-none" />
          <div className="h-9 flex-1 rounded-lg bg-surface-2 animate-pulse sm:w-28 sm:flex-none" />
        </div>
      </div>
    </div>
  );
}

function GoalRightPanelSkeleton() {
  return (
    <div className="w-full space-y-3 lg:w-72 lg:shrink-0">
      {/* Life Compass */}
      <div className="rounded-lg border border-border-subtle bg-surface-1 p-3 flex flex-col items-center gap-3">
        <div className="h-3 w-24 rounded bg-surface-2 animate-pulse self-start" />
        <div className="h-44 w-44 rounded-full bg-surface-2 animate-pulse" />
      </div>
      {/* Focus Goal */}
      <div className="rounded-lg border border-border-subtle bg-surface-1 p-3 space-y-3">
        <div className="h-3 w-10 rounded bg-surface-2 animate-pulse" />
        <div className="space-y-1.5">
          <div className="h-3 w-full rounded bg-surface-2 animate-pulse" />
          <div className="h-3 w-2/3 rounded bg-surface-2 animate-pulse" />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1 rounded-full bg-surface-2 animate-pulse" />
          <div className="h-3 w-8 rounded bg-surface-2 animate-pulse" />
        </div>
        <div className="h-3 w-20 rounded bg-surface-2 animate-pulse" />
      </div>
      {/* Stats */}
      <div className="rounded-lg border border-border-subtle bg-surface-1 p-3 space-y-2.5">
        <div className="h-3 w-10 rounded bg-surface-2 animate-pulse" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="h-3 w-16 rounded bg-surface-2 animate-pulse" />
            <div className="h-3 w-6 rounded bg-surface-2 animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}

function GoalHeaderSkeleton() {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-2">
        <div className="h-5 w-20 rounded bg-surface-2 animate-pulse" />
        <div className="h-3.5 w-36 rounded bg-surface-2 animate-pulse" />
      </div>
      <div className="h-8 w-24 rounded-md bg-surface-2 animate-pulse shrink-0" />
    </div>
  );
}

export function GoalsLoadingSkeleton() {
  return (
    <div className="space-y-4">
      <GoalHeaderSkeleton />
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="flex-1 min-w-0 space-y-3">
          <GoalTabsRowSkeleton />
          {Array.from({ length: 4 }).map((_, i) => (
            <GoalCardSkeleton key={i} />
          ))}
        </div>
        <GoalRightPanelSkeleton />
      </div>
    </div>
  );
}
