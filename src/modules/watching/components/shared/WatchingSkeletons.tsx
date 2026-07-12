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
    <div>
      <div className="flex items-center justify-between mb-1.5">
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
      <div className="hidden lg:grid gap-4 py-1.5" style={{ gridTemplateColumns: `repeat(${cards}, 1fr)` }}>
        {Array.from({ length: cards }).map((_, i) => (
          <div key={i} className="animate-pulse rounded-xl overflow-hidden bg-surface-2 aspect-video" />
        ))}
      </div>
      {/* Mobile: poster rail (~2.4 visible) */}
      <div className="flex gap-3 py-1.5 lg:hidden">
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
      {/* header — mirrors the real "Don't Miss" title + subtitle (no shift on resolve) */}
      <div className="mb-1.5">
        <div className="h-5 w-28 rounded bg-surface-2 animate-pulse" />
        <div className="mt-1 h-3 w-44 rounded bg-surface-2 animate-pulse" />
      </div>
      {/* Desktop: mirrors the real accordion card while images stream — a dark card
          with a pulsing poster anchored left (same as DontMissCard), and the same
          py-1.5 wrapper, so skeleton → real-cards is seamless in shape AND spacing. */}
      <div className="hidden py-1.5 lg:block">
        <div className="flex h-60 gap-4">
          {[EXP, COL, COL, COL, COL, COL].map((f, i) => (
            <div
              key={i}
              className="relative overflow-hidden rounded-card ring-1 ring-inset ring-white/10"
              style={{ flex: f, backgroundColor: "#0e0e10" }}
            >
              <div className="absolute inset-y-0 left-0 bg-surface-2 animate-pulse" style={{ aspectRatio: "2/3" }} />
            </div>
          ))}
        </div>
      </div>
      {/* Mobile: poster rail */}
      <div className="flex gap-3 py-1.5 lg:hidden">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="aspect-2/3 w-[42%] shrink-0 animate-pulse rounded-xl bg-surface-2" />
        ))}
      </div>
    </section>
  );
}

// ─── For You skeleton ──────────────────────────────────────────────────────────

export function ForYouSkeleton() {
  return (
    <section>
      {/* header — title + subtitle + nav arrows, mirrors the real For You header */}
      <div className="mb-1.5 flex items-center justify-between">
        <div>
          <div className="h-5 w-24 rounded bg-surface-2 animate-pulse" />
          <div className="mt-1 h-3 w-40 rounded bg-surface-2 animate-pulse" />
        </div>
        <div className="hidden gap-2 lg:flex">
          <div className="h-8 w-8 rounded-full bg-surface-2 animate-pulse" />
          <div className="h-8 w-8 rounded-full bg-surface-2 animate-pulse" />
        </div>
      </div>
      {/* Desktop: backdrop row — py-1.5 mirrors the real row's hover-scale headroom */}
      <div className="hidden gap-4 py-1.5 lg:flex">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex-1 aspect-video rounded-xl bg-surface-2 animate-pulse" />
        ))}
      </div>
      {/* Mobile: poster rail */}
      <div className="flex gap-3 py-1.5 lg:hidden">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="aspect-2/3 w-[42%] shrink-0 rounded-xl bg-surface-2 animate-pulse" />
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

// Mirrors the real detail page: bottom-anchored hero, then the 2fr/1fr split with the
// branded card leading the rail. (The old one still drew a bordered, darker rail and a
// zinc-950 page — neither has existed for a while, so the layout jumped on load.)
export function DetailSkeleton() {
  return (
    <div className="min-h-screen bg-surface-0">
      {/* ── Mobile — the real hero FLOWS: backdrop, then a centred column pulled up over it.
             The old skeleton anchored everything to the bottom of the backdrop (the desktop
             shape), so the page re-laid itself out the moment the data landed. ── */}
      <div className="lg:hidden">
        <div className="relative aspect-video w-full overflow-hidden bg-surface-1">
          <div className="absolute inset-0 bg-linear-to-t from-surface-0 via-surface-0/30 to-transparent" />
        </div>
        <div className="relative -mt-16 flex flex-col items-center px-4 pb-2">
          <div className="aspect-2/3 w-(--poster-md) shrink-0 animate-pulse rounded-tile bg-surface-2" />
          <div className="mt-3 h-6 w-40 animate-pulse rounded-lg bg-surface-2" />
          <div className="mt-3 flex gap-1.5">
            {[14, 16, 12].map((w, i) => (
              <div key={i} className="h-5 animate-pulse rounded-full bg-surface-2" style={{ width: `${w * 4}px` }} />
            ))}
          </div>
          <div className="mt-2.5 h-4 w-48 animate-pulse rounded bg-surface-2" />
          <div className="mt-3 h-14 w-full animate-pulse rounded-lg bg-surface-2" />
          {/* Reserved trailer slot — same height as the real button, so nothing shifts */}
          <div className="mt-4 h-8 w-32 animate-pulse rounded-full bg-surface-2" />
        </div>
      </div>

      {/* ── Desktop — content anchored to the bottom of the banner ── */}
      <div className="relative hidden w-full overflow-hidden bg-surface-1 lg:block lg:aspect-21/9 lg:max-h-[55vh] lg:min-h-70">
        <div className="absolute inset-0 bg-linear-to-t from-surface-0 via-surface-0/40 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 px-10 pb-8">
          <div className="flex items-end gap-8">
            <div className="aspect-2/3 w-(--poster-xl) shrink-0 animate-pulse rounded-tile bg-surface-2" />
            <div className="flex-1 space-y-3 pb-1">
              <div className="h-7 w-2/3 animate-pulse rounded-lg bg-surface-2" />
              <div className="h-4 w-1/3 animate-pulse rounded bg-surface-2" />
              <div className="h-10 w-full max-w-4xl animate-pulse rounded-lg bg-surface-2" />
              <div className="h-8 w-32 animate-pulse rounded-full bg-surface-2" />
            </div>
          </div>
        </div>
      </div>

      <div className="relative z-10 grid grid-cols-1 lg:-mt-6 lg:grid-cols-[2fr_1fr]">
        {/* Left — My Take, then the long-form sections */}
        <div className="min-w-0 space-y-5 px-4 py-6 lg:space-y-6 lg:py-8 lg:pl-8 lg:pr-2">
          {[36, 28].map((w, i) => (
            <div key={i}>
              <div className="mb-3 h-4 animate-pulse rounded bg-surface-2" style={{ width: `${w}%`, maxWidth: 180 }} />
              <div className="h-36 animate-pulse rounded-card bg-surface-1" />
            </div>
          ))}
          <div>
            <div className="mb-3 h-4 w-24 animate-pulse rounded bg-surface-2" />
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="aspect-2/3 animate-pulse rounded-tile bg-surface-2" />
              ))}
            </div>
          </div>
        </div>

        {/* Rail — the branded status card leads, then the quiet blocks */}
        <div className="min-w-0 space-y-5 px-4 py-6 lg:space-y-6 lg:py-8 lg:pl-2 lg:pr-8">
          <div className="h-56 animate-pulse rounded-card bg-surface-2" />
          <div>
            <div className="mb-3 h-4 w-20 animate-pulse rounded bg-surface-2" />
            <div className="h-48 animate-pulse rounded-card bg-surface-1" />
          </div>
          <div>
            <div className="mb-3 h-4 w-16 animate-pulse rounded bg-surface-2" />
            <div className="h-28 animate-pulse rounded-card bg-surface-1" />
          </div>
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
