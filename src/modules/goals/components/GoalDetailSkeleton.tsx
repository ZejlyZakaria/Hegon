// Loading skeleton for a Goal detail page — mirrors the REAL layout 1:1 (zero
// shift): flush "Go back" link, surface-card cards at rounded-card, the hero +
// milestones + fueling on the left, and the right rail (Progress · Momentum ·
// Info · Stats · Connections). Neutral monochrome — no colored placeholders.

function Bar({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-surface-2 ${className ?? ""}`} />;
}

function CardTitle({ w = "w-24" }: { w?: string }) {
  return <div className={`mb-3 h-3 ${w} animate-pulse rounded bg-surface-2`} />;
}

function HeroCardSkeleton() {
  return (
    <div className="surface-card rounded-card p-3">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-5 w-16 animate-pulse rounded-chip bg-surface-2" />
          <Bar className="h-6 w-3/5" />
          <Bar className="h-3.5 w-3/4" />
        </div>
        <Bar className="h-8 w-8 shrink-0 rounded-control" />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Bar className="h-3 w-14" />
          <Bar className="h-3.5 w-8" />
        </div>
        <Bar className="h-1.5 w-full rounded-full" />
        <Bar className="h-3 w-32" />
      </div>
    </div>
  );
}

function MilestonesCardSkeleton() {
  return (
    <div className="surface-card rounded-card p-4">
      <CardTitle w="w-20" />
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <Bar className="h-4 w-4 shrink-0 rounded-sm" />
            <Bar className="h-3 flex-1" />
            <Bar className="h-3 w-16 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}

function FuelingCardSkeleton() {
  return (
    <div className="surface-card rounded-card p-4">
      <CardTitle w="w-28" />
      {/* Tasks */}
      <div className="mb-2 flex items-center justify-between">
        <Bar className="h-3 w-10" />
        <Bar className="h-6 w-20 rounded-control" />
      </div>
      <div className="space-y-2">
        {[1, 2].map((i) => (
          <div key={i} className="flex items-center gap-2 rounded-control border border-border-subtle px-2 py-1.5">
            <Bar className="h-3.5 w-3.5 shrink-0 rounded-sm" />
            <Bar className="h-3 flex-1" />
            <Bar className="h-3 w-12 shrink-0" />
          </div>
        ))}
      </div>
      <div className="my-4 h-px bg-border-subtle" />
      {/* Habits */}
      <div className="mb-2 flex items-center justify-between">
        <Bar className="h-3 w-12" />
        <Bar className="h-6 w-20 rounded-control" />
      </div>
      <div className="space-y-1.5">
        {[1, 2].map((i) => (
          <div key={i} className="flex items-center gap-2 px-2 py-1.5">
            <Bar className="h-5 w-5 shrink-0 rounded" />
            <Bar className="h-3 flex-1" />
            <Bar className="h-3 w-10 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ProgressControlSkeleton() {
  return (
    <div className="surface-card rounded-card p-4">
      <CardTitle w="w-28" />
      <div className="mb-4 h-8 w-full animate-pulse rounded-control bg-surface-2" />
      <div className="flex justify-center py-1">
        <Bar className="h-10 w-20" />
      </div>
      <Bar className="mt-3 h-1.5 w-full rounded-full" />
      <Bar className="mx-auto mt-3 h-3 w-32" />
    </div>
  );
}

function MomentumSkeleton() {
  return (
    <div className="surface-card rounded-card p-4">
      <CardTitle w="w-24" />
      <Bar className="h-3 w-36" />
      <Bar className="mt-3 h-12 w-full rounded-control" />
    </div>
  );
}

function GoalInfoSkeleton() {
  return (
    <div className="surface-card rounded-card p-4">
      <CardTitle w="w-16" />
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center justify-between">
            <Bar className="h-3 w-14" />
            <Bar className="h-6 w-24 rounded-control" />
          </div>
        ))}
      </div>
    </div>
  );
}

function StatsSkeleton() {
  return (
    <div className="surface-card rounded-card p-3">
      <CardTitle w="w-10" />
      <div className="grid grid-cols-2 gap-2">
        {[1, 2].map((i) => (
          <div key={i} className="space-y-1.5 rounded-control bg-surface-2 px-3 py-2 text-center">
            <Bar className="mx-auto h-5 w-8" />
            <Bar className="mx-auto h-3 w-10" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ConnectionsSkeleton() {
  return (
    <div className="surface-card rounded-card p-4">
      <CardTitle w="w-24" />
      <Bar className="mb-1.5 h-3 w-20" />
      <div className="h-8 w-full animate-pulse rounded-control bg-surface-2" />
    </div>
  );
}

export function MilestoneListSkeleton() {
  return <div className="h-9 animate-pulse rounded-control bg-surface-2" />;
}

export function GoalDetailSkeleton() {
  return (
    <div className="w-full">
      {/* Back — flush under the topbar (same rhythm as a tab rail) */}
      <div className="px-4 sm:px-6">
        <div className="flex items-center gap-2 py-2.5">
          <Bar className="h-3.5 w-3.5" />
          <Bar className="h-3.5 w-16" />
        </div>
      </div>

      {/* Content — its own padding (the back link above stays flush) */}
      <div className="flex flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:gap-6 lg:items-start">
        {/* Left column */}
        <div className="min-w-0 flex-1 space-y-3">
          <HeroCardSkeleton />
          <MilestonesCardSkeleton />
          <FuelingCardSkeleton />
        </div>

        {/* Right column */}
        <div className="w-full space-y-3 lg:w-72 lg:shrink-0">
          <ProgressControlSkeleton />
          <MomentumSkeleton />
          <GoalInfoSkeleton />
          <StatsSkeleton />
          <ConnectionsSkeleton />
        </div>
      </div>
    </div>
  );
}
