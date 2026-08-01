// Loading skeleton for the Goals page — mirrors the REAL design 1:1 (zero layout
// shift on hydration): surface-card cards at rounded-card, the 3-column GoalCard
// grid, the flush full-width toolbar, and the right rail (Focus → Compass → Stats).

function Bar({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={`animate-pulse rounded bg-surface-2 ${className}`} style={style} />;
}

function GoalCardSkeleton() {
  return (
    <div className="surface-card rounded-card p-3.5">
      <div className="flex flex-col gap-3 lg:grid lg:grid-cols-[minmax(0,1fr)_180px_140px] lg:items-center lg:gap-5">
        {/* Content */}
        <div className="min-w-0">
          <div className="h-5 w-16 animate-pulse rounded-chip bg-surface-2" />
          <Bar className="mt-1.5 h-4 w-3/4" />
          <Bar className="mt-1 h-3 w-1/2" />
        </div>

        {/* Progress column */}
        <div className="w-full lg:w-45">
          <div className="mb-1.5 flex items-baseline justify-between">
            <Bar className="h-4 w-9" />
            <Bar className="h-2.5 w-16" />
          </div>
          <div className="h-1.5 w-full animate-pulse rounded-full bg-surface-2" />
        </div>

        {/* Meta column — date + priority */}
        <div className="flex items-center justify-between gap-3 lg:flex-col lg:items-end lg:gap-1.5">
          <Bar className="h-3 w-12" />
          <Bar className="h-3 w-14" />
        </div>
      </div>
    </div>
  );
}

function GoalToolbarSkeleton() {
  return (
    <div>
      {/* Row 1 — tabs + action (filters inline only from lg, mirroring the real page) */}
      <div className="flex items-center gap-x-3">
        {/* Tabs */}
        <div className="flex items-center py-2">
          {[32, 46, 72, 68, 62].map((w, i) => (
            <Bar key={i} className="mx-3 h-5" style={{ width: w }} />
          ))}
        </div>
        {/* Filters + action */}
        <div className="ml-auto flex items-center gap-2 pb-1.5">
          <div className="hidden items-center gap-2 lg:flex">
            <div className="h-9 w-48 animate-pulse rounded-control bg-surface-2" />
            <div className="h-9 w-32 animate-pulse rounded-control bg-surface-2" />
            <div className="h-9 w-28 animate-pulse rounded-control bg-surface-2" />
          </div>
          <div className="h-9 w-9 animate-pulse rounded-control bg-surface-2 sm:w-28" />
        </div>
      </div>

      {/* Row 2 (mobile + iPad portrait) — search + filters, matching the real toolbar */}
      <div className="mt-1.5 flex items-center gap-2 pb-2 lg:hidden">
        <div className="h-9 flex-1 animate-pulse rounded-control bg-surface-2" />
        <div className="h-9 w-32 animate-pulse rounded-control bg-surface-2" />
        <div className="h-9 w-28 animate-pulse rounded-control bg-surface-2" />
      </div>
    </div>
  );
}

function GoalRightPanelSkeleton() {
  return (
    <div className="space-y-3">
      {/* Focus — branded hero (first by design). Skeleton stays neutral: a colored
          placeholder would break the loading code; zero-shift is about size, not hue. */}
      <div className="surface-card rounded-card p-3.5">
        <Bar className="mb-3 h-3 w-12" />
        <div className="mb-3 space-y-1.5">
          <Bar className="h-3.5 w-full" />
          <Bar className="h-3.5 w-2/3" />
        </div>
        <div className="mb-2 flex items-center gap-2">
          <div className="h-1.5 flex-1 animate-pulse rounded-full bg-surface-2" />
          <Bar className="h-3 w-8" />
        </div>
        <Bar className="h-3 w-24" />
      </div>

      {/* Life Compass */}
      <div className="surface-card flex flex-col items-center gap-3 rounded-card p-3">
        <Bar className="h-3 w-24 self-start" />
        <div className="h-44 w-44 animate-pulse rounded-full bg-surface-2" />
      </div>

      {/* Stats */}
      <div className="surface-card rounded-card p-3">
        <Bar className="mb-3 h-3 w-10" />
        <div className="space-y-2.5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between">
              <Bar className="h-3 w-16" />
              <Bar className="h-4 w-6" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function GoalsLoadingSkeleton() {
  return (
    <div className="flex min-h-full flex-col">
      {/* Full-width toolbar rail — flush under the TopBar (mirrors the real one). */}
      <div className="border-b border-border-subtle px-4 sm:px-6">
        <GoalToolbarSkeleton />
      </div>

      {/* Content */}
      <div className="px-4 py-4 sm:px-6 sm:py-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          <div className="min-w-0 flex-1 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <GoalCardSkeleton key={i} />
            ))}
          </div>
          <div className="w-full lg:w-72 lg:shrink-0">
            <GoalRightPanelSkeleton />
          </div>
        </div>
      </div>
    </div>
  );
}
