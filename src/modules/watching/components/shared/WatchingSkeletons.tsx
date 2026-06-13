// modules/watching/components/shared/WatchingSkeletons.tsx
// Single source of truth for every full-section Watching skeleton.
// Same pulse animation + surface tokens everywhere. (Tiny 1–3 div micro-loaders
// that live inside a larger component's render — InList chips, EpisodeHighlights,
// list rows — stay local to that component on purpose: they're layout-coupled,
// not reusable skeletons.)

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
        <div className="hidden lg:flex gap-2">
          <Pulse className="h-8 w-8 rounded-full bg-surface-2" />
          <Pulse className="h-8 w-8 rounded-full bg-surface-2" />
        </div>
      </div>
      {/* Desktop: backdrop grid */}
      <div className="hidden lg:grid gap-4" style={{ gridTemplateColumns: `repeat(${cards}, 1fr)` }}>
        {Array.from({ length: cards }).map((_, i) => (
          <div key={i} className="animate-pulse rounded-xl overflow-hidden bg-surface-2 aspect-video" />
        ))}
      </div>
      {/* Mobile: poster rail (~2.4 visible) */}
      <div className="flex gap-3 lg:hidden">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="w-[42%] shrink-0 animate-pulse rounded-xl overflow-hidden bg-surface-2 aspect-2/3" />
        ))}
      </div>
    </div>
  );
}

// ─── Trending (DontMiss) skeleton ──────────────────────────────────────────────

export function DontMissSkeleton() {
  const EXP = 22;
  const COL = 7;
  return (
    <section>
      <div className="flex items-center gap-2 mb-4">
        <div className="w-3.5 h-3.5 rounded-full bg-surface-2 animate-pulse" />
        <div className="w-20 h-3 rounded bg-surface-2 animate-pulse" />
      </div>
      {/* Desktop: accordion shape */}
      <div className="hidden h-60 gap-3 lg:flex">
        {[EXP, COL, COL, COL, COL, COL].map((f, i) => (
          <div key={i} className="rounded-2xl bg-surface-1 animate-pulse" style={{ flex: f }} />
        ))}
      </div>
      {/* Mobile: poster rail */}
      <div className="flex gap-3 lg:hidden">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="aspect-2/3 w-[42%] shrink-0 animate-pulse rounded-xl bg-surface-1" />
        ))}
      </div>
    </section>
  );
}

// ─── For You skeleton ──────────────────────────────────────────────────────────

export function ForYouSkeleton() {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <div className="h-5 w-24 rounded bg-surface-2 animate-pulse" />
      </div>
      {/* Desktop: backdrop row */}
      <div className="hidden gap-4 lg:flex">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex-1 aspect-video rounded-xl bg-surface-1 animate-pulse" />
        ))}
      </div>
      {/* Mobile: poster rail */}
      <div className="flex gap-3 lg:hidden">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="aspect-2/3 w-[42%] shrink-0 rounded-xl bg-surface-1 animate-pulse" />
        ))}
      </div>
    </section>
  );
}

// ─── Stats skeleton ────────────────────────────────────────────────────────────

export function StatsSkeleton() {
  return (
    <div className="space-y-4 p-4 md:p-6 animate-pulse">
      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {[1, 2, 3].map((i) => <div key={i} className="h-7 w-16 shrink-0 rounded-lg bg-surface-1" />)}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-28 rounded-xl bg-surface-1" />)}
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {[1, 2, 3].map((i) => <div key={i} className="h-60 rounded-xl bg-surface-1" />)}
      </div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="h-52 rounded-xl bg-surface-1" />
        <div className="h-52 rounded-xl bg-surface-1" />
      </div>
    </div>
  );
}

// ─── Detail skeleton ──────────────────────────────────────────────────────────
// Shared by the detail page's client loading state AND its route-level loading.tsx
// so navigating in never flashes the carousel (parent) skeleton first.

export function DetailSkeleton() {
  return (
    <div className="min-h-screen bg-zinc-950">
      <div className="relative w-full animate-pulse bg-surface-1" style={{ aspectRatio: "21/9", maxHeight: "55vh", minHeight: 280 }}>
        <div className="absolute bottom-0 left-0 right-0 px-6 pb-8 md:px-10">
          <div className="flex items-end gap-6">
            <div className="aspect-2/3 w-32 shrink-0 rounded-xl bg-surface-2 md:w-40" />
            <div className="flex-1 space-y-3 pb-2">
              <div className="h-7 w-2/3 rounded-lg bg-surface-2" />
              <div className="h-4 w-1/3 rounded bg-surface-1" />
              <div className="h-12 w-full max-w-xl rounded-lg bg-surface-1" />
            </div>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-5 p-6 md:p-10">
          <div className="h-3 w-1/4 rounded bg-surface-2" />
          <div className="h-40 rounded-2xl bg-surface-1" />
        </div>
        <div className="space-y-5 border-l border-border-subtle bg-[#0c0c0f] p-6">
          <div className="h-3 w-1/3 rounded bg-surface-2" />
          <div className="h-20 rounded-xl bg-surface-2" />
        </div>
      </div>
    </div>
  );
}

// ─── Library skeleton ─────────────────────────────────────────────────────────

export function LibrarySkeleton() {
  return (
    <div className="space-y-6">
      {/* Header — mirrors LibraryClient's responsive split */}
      <div className="space-y-2">
        {/* Desktop: chips left + search/sort/add right */}
        <div className="hidden items-center gap-3 sm:flex">
          <div className="flex gap-2">
            <Pulse className="h-9 w-10 rounded-md bg-surface-2" />
            <Pulse className="h-9 w-14 rounded-md bg-surface-2" />
            <Pulse className="h-9 w-16 rounded-md bg-surface-2" />
            <Pulse className="h-9 w-16 rounded-md bg-surface-2" />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Pulse className="h-9 w-56 rounded-lg bg-surface-2" />
            <Pulse className="h-9 w-36 rounded-lg bg-surface-2" />
            <Pulse className="h-9 w-16 rounded-lg bg-surface-2" />
          </div>
        </div>
        {/* Mobile: select + add  /  search + sort */}
        <div className="space-y-2 sm:hidden">
          <div className="flex items-center gap-2">
            <Pulse className="h-9 w-28 rounded-lg bg-surface-2" />
            <Pulse className="ml-auto h-9 w-9 rounded-lg bg-surface-2" />
          </div>
          <div className="flex items-center gap-2">
            <Pulse className="h-9 flex-1 rounded-lg bg-surface-2" />
            <Pulse className="h-9 w-32 rounded-lg bg-surface-2" />
          </div>
        </div>
        {/* count */}
        <Pulse className="h-3 w-16 bg-surface-2" />
      </div>

      {/* Grid */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-3">
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
