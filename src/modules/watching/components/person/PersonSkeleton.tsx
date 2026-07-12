"use client";

const Bar = ({ className }: { className: string }) => (
  <div className={`animate-pulse rounded bg-surface-2 ${className}`} />
);

const PosterGrid = ({ n }: { n: number }) => (
  <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
    {Array.from({ length: n }, (_, i) => (
      <div key={i}>
        <div className="aspect-2/3 animate-pulse rounded-tile bg-surface-2" />
        <Bar className="mt-2 h-3 w-4/5" />
      </div>
    ))}
  </div>
);

// Mirrors the real page's silhouette (hero + 2fr/1fr split + rail cards) so the layout
// never jumps when the data lands.
export function PersonSkeleton() {
  return (
    <div className="min-h-screen bg-surface-0">
      {/* Hero */}
      <div className="relative aspect-video w-full overflow-hidden bg-surface-1 lg:aspect-21/9 lg:max-h-[55vh] lg:min-h-70">
        <div className="absolute inset-0 bg-linear-to-t from-surface-0 via-surface-0/40 to-transparent lg:bg-linear-to-b lg:via-surface-0/50" />
      </div>
      {/* Mobile — the real hero is a CENTRED column (portrait → name → facts → bio). The
          skeleton drew the old beside-the-poster layout, so the page re-laid itself out the
          instant the data landed. */}
      <div className="relative -mt-16 flex flex-col items-center px-4 pb-2 lg:hidden">
        <div className="aspect-2/3 w-(--poster-md) shrink-0 animate-pulse rounded-tile bg-surface-2" />
        <Bar className="mt-3 h-6 w-40" />
        <Bar className="mt-2.5 h-4 w-56" />
        <Bar className="mt-3 h-14 w-full" />
      </div>

      {/* Mobile slot — the branded card rides right after the hero, as on the real page */}
      <div className="px-4 pt-4 lg:hidden">
        <div className="h-52 animate-pulse rounded-card bg-surface-2" />
      </div>

      <div className="relative z-10 grid grid-cols-1 lg:-mt-6 lg:grid-cols-[2fr_1fr]">
        <div className="min-w-0 space-y-5 px-4 py-6 lg:space-y-6 lg:py-8 lg:pl-8 lg:pr-2">
          <div>
            <Bar className="mb-3 h-4 w-44" />
            <PosterGrid n={6} />
          </div>
          <div>
            <Bar className="mb-3 h-4 w-32" />
            <PosterGrid n={12} />
          </div>
        </div>

        <div className="min-w-0 space-y-5 px-4 py-6 lg:space-y-6 lg:py-8 lg:pl-2 lg:pr-8">
          {/* Desktop only — on mobile this card already appeared under the hero */}
          <div className="hidden h-52 animate-pulse rounded-card bg-surface-2 lg:block" />
          <div>
            <Bar className="mb-3 h-4 w-32" />
            <div className="h-40 animate-pulse rounded-card bg-surface-2" />
          </div>
          <div>
            <Bar className="mb-3 h-4 w-28" />
            <div className="h-28 animate-pulse rounded-card bg-surface-2" />
          </div>
        </div>
      </div>
    </div>
  );
}
