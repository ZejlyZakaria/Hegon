// components/watching/WatchingSkeletons.tsx
// single source of truth for all watching skeletons
// same pulse animation + zinc-800 everywhere

function Pulse({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-lg bg-surface-2 ${className}`} />;
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
      {/* Header — chips left + search/sort/add right + count below */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          {/* chips */}
          <div className="flex gap-2">
            <Pulse className="h-9 w-10 rounded-md bg-surface-2" />
            <Pulse className="h-9 w-14 rounded-md bg-surface-2" />
            <Pulse className="h-9 w-16 rounded-md bg-surface-2" />
            <Pulse className="h-9 w-16 rounded-md bg-surface-2" />
          </div>
          {/* right controls */}
          <div className="flex items-center gap-2 ml-auto">
            <Pulse className="h-9 w-56 rounded-lg bg-surface-2" />
            <Pulse className="h-9 w-36 rounded-lg bg-surface-2" />
            <Pulse className="h-9 w-16 rounded-lg bg-surface-2" />
          </div>
        </div>
        {/* count */}
        <Pulse className="h-3 w-16 bg-surface-2" />
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-3">
        {Array.from({ length: 20 }).map((_, i) => (
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