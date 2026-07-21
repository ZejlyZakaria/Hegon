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
      {/* ── Mobile hero — the real hero is a CENTRED column (portrait → name → facts → bio),
          pulled up over the backdrop. `surface-2` + pulse, not `surface-1`: the real hero is a
          photograph under a gradient, and `surface-1` (#161619) sits close enough to the page's
          own `surface-0` (#0e0e11) that the "banner" read as empty page, not as artwork loading
          in. Same fix as the media detail hero (`WatchingSkeletons.tsx`) — one bug, two files. */}
      <div className="lg:hidden">
        <div className="relative aspect-video w-full animate-pulse overflow-hidden bg-surface-2">
          <div className="absolute inset-0 bg-linear-to-t from-surface-0 via-surface-0/30 to-transparent" />
        </div>
        <div className="relative -mt-16 flex flex-col items-center px-4 pb-2">
          <div className="aspect-2/3 w-(--poster-md) shrink-0 animate-pulse rounded-tile bg-surface-2" />
          <Bar className="mt-3 h-6 w-40" />
          <Bar className="mt-2.5 h-4 w-56" />
          <Bar className="mt-3 h-14 w-full" />
        </div>
      </div>

      {/* ── Desktop hero — bottom-anchored, mirrors DetailSkeleton's `HeroSkeleton`: portrait +
          name + facts + bio reserved over the banner. THE bug the owner pointed at: this used to
          be one single responsive div, and past `lg:`, that div only carried the backdrop
          rectangle — nothing reserved the content block at all. The real desktop hero anchors a
          poster, "Matt Smith", "Actor · b. 1982 · Northampton…" and the bio at the bottom-left;
          the old skeleton showed a plain empty banner there and the whole block popped in at
          once the moment the row landed. No tags row, no trailer button here — Person has
          neither; that's the "necessary adaptation" from the detail page's shape. */}
      <div className="relative hidden w-full animate-pulse overflow-hidden bg-surface-2 lg:block lg:aspect-21/9 lg:max-h-[55vh] lg:min-h-70">
        <div className="absolute inset-0 bg-linear-to-t from-surface-0 via-surface-0/40 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 px-10 pb-8">
          <div className="flex items-end gap-8">
            <div className="aspect-2/3 w-(--poster-xl) shrink-0 animate-pulse rounded-tile bg-surface-2" />
            <div className="flex-1 space-y-3 pb-1">
              <div className="h-7 w-2/3 animate-pulse rounded-control bg-surface-2" />
              <div className="h-4 w-1/3 animate-pulse rounded bg-surface-2" />
              <div className="h-10 w-full max-w-4xl animate-pulse rounded-control bg-surface-2" />
            </div>
          </div>
        </div>
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
            {/* Not seen yet starts at exactly 18 — `visibleCount`'s initial state in
                PersonPage.tsx, a fixed constant, not a data-dependent guess like the row above. */}
            <PosterGrid n={18} />
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
