// components/watching/WatchingSkeletons.tsx
// single source of truth for all watching skeletons
// same pulse animation + zinc-800 everywhere

function Pulse({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-lg bg-surface-2 ${className}`} />;
}

// ─── Hero skeleton ────────────────────────────────────────────────────────────

export function MoviesHeroSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-4 mb-2">

      {/* main hero — 2/3 — matches col-span-2 min-h-[280px] */}
      <div className="col-span-2 rounded-2xl overflow-hidden relative bg-surface-2 animate-pulse min-h-70">
        {/* trending badge placeholder */}
        <div className="absolute top-4 left-4">
          <Pulse className="h-6 w-36 rounded-full bg-surface-1" />
        </div>
        {/* bottom content */}
        <div className="absolute bottom-0 inset-x-0 p-5 space-y-2">
          <div className="flex gap-2 mb-1">
            <Pulse className="h-4 w-14 rounded-full bg-surface-1" />
            <Pulse className="h-4 w-14 rounded-full bg-surface-1" />
          </div>
          <Pulse className="h-7 w-2/3 bg-surface-1" />
          <div className="flex gap-3">
            <Pulse className="h-4 w-12 bg-surface-1" />
            <Pulse className="h-4 w-8 bg-surface-1" />
          </div>
          <Pulse className="h-3 w-full bg-surface-1" />
          <Pulse className="h-3 w-4/5 bg-surface-1" />
        </div>
      </div>

      {/* recommendations panel — 1/3 — matches col-span-1 */}
      <div className="col-span-1 rounded-2xl bg-surface-1 border border-border-subtle p-5 space-y-4">
        {/* header */}
        <div className="flex items-center gap-2">
          <Pulse className="h-3.5 w-3.5 rounded-full bg-surface-1" />
          <Pulse className="h-4 w-32 bg-surface-1" />
        </div>
        {/* 3 recommendation cards */}
        {[1, 2, 3].map(i => (
          <div key={i} className="flex gap-3">
            <Pulse className="w-14 h-20 shrink-0 bg-surface-1" />
            <div className="flex-1 space-y-2 pt-1">
              <Pulse className="h-3.5 w-full bg-surface-1" />
              <Pulse className="h-3 w-1/3 bg-surface-1" />
              <Pulse className="h-3 w-1/4 bg-surface-1" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Carousel skeleton ────────────────────────────────────────────────────────

export function CarouselSkeleton({ cards = 4 }: { cards?: number }) {
  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-5">
        <div className="space-y-2">
          <Pulse className="h-5 w-40 bg-surface-2" />
          <Pulse className="h-3 w-24 bg-surface-2" />
        </div>
        <div className="flex gap-2">
          <Pulse className="h-8 w-8 rounded-full bg-surface-2" />
          <Pulse className="h-8 w-8 rounded-full bg-surface-2" />
        </div>
      </div>
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${cards}, 1fr)` }}>
        {Array.from({ length: cards }).map((_, i) => (
          <div key={i} className="animate-pulse rounded-xl overflow-hidden bg-surface-2 aspect-video" />
        ))}
      </div>
    </div>
  );
}

// ─── Library skeleton ─────────────────────────────────────────────────────────

export function LibrarySkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <Pulse className="h-6 w-32 bg-surface-2" />
          <Pulse className="h-3.5 w-20 bg-surface-2" />
        </div>
        <div className="flex items-center gap-3">
          <Pulse className="h-9 w-64 rounded-xl bg-surface-2" />
          <Pulse className="h-9 w-20 rounded-lg bg-surface-2" />
        </div>
      </div>

      {/* Filters — 4 chips + sort select */}
      <div className="flex items-center gap-3">
        <div className="flex gap-2">
          <Pulse className="h-8 w-10 rounded-full bg-surface-2" />
          <Pulse className="h-8 w-14 rounded-full bg-surface-2" />
          <Pulse className="h-8 w-16 rounded-full bg-surface-2" />
          <Pulse className="h-8 w-16 rounded-full bg-surface-2" />
        </div>
        <Pulse className="h-9 w-40 rounded-lg bg-surface-2 ml-auto" />
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-6">
        {Array.from({ length: 16 }).map((_, i) => (
          <div key={i} className="animate-pulse space-y-2">
            <Pulse className="aspect-2/3 w-full bg-surface-2 rounded-xl" />
            <Pulse className="h-3 w-3/4 bg-surface-2" />
            <Pulse className="h-3 w-1/2 bg-surface-2" />
          </div>
        ))}
      </div>
    </div>
  );
}