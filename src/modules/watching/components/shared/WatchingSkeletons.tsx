// modules/watching/components/shared/WatchingSkeletons.tsx
// Single source of truth for every full-section Watching skeleton.
// Same pulse animation + surface tokens everywhere. (Tiny 1–3 div micro-loaders
// that live inside a larger component's render — InList chips, EpisodeHighlights,
// list rows — stay local to that component on purpose: they're layout-coupled,
// not reusable skeletons.)
//
// Cast & Crew and Episodes are NOT redrawn here. Both already have a correct, measured
// skeleton living next to the real component that mounts once the row resolves
// (`CastCrewSkeleton`, `EpisodeCardsSkeleton`). A second, hand-guessed version here was the
// actual bug: it drew a rectangle-grid poster placeholder for Cast (circles, in a scrolling
// rail — not a grid) and a bare image tile for Episodes (missing the number/title/overview
// block under it). The page didn't just resize when the real ones mounted, it changed shape —
// which is the "something appears, then something else" fault, not a sizing rounding error.
import { CastCrewSkeleton } from "../detail/CastCrew";
import { EpisodeCardsSkeleton } from "../detail/Episodes";

function Pulse({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-control bg-surface-2 ${className}`} />;
}

// ─── Carousel skeleton ────────────────────────────────────────────────────────

/**
 * `MediaCarousel` (the real thing every one of these stands in for) sizes its cards off
 * `window.innerWidth` at JS breakpoints that don't line up with any single fixed count: 3 cards
 * from 1024px, 5 from 1280px. A flat guess — this used to default to 4, a number `MediaCarousel`
 * never actually shows at ANY width — meant every card resized the instant real data replaced it,
 * even though the row's total width was already right. `loading.tsx` had already hand-patched the
 * symptom (`cards={5}`) instead of the cause; two matching CSS breakpoints replace both the prop
 * and the patch.
 */
export function CarouselSkeleton() {
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
      {/* Desktop: backdrop grid — 3-up from lg (1024px), 5-up from xl (1280px), same as MediaCarousel. */}
      <div className="hidden lg:grid xl:hidden grid-cols-3 gap-4 py-1.5">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="animate-pulse rounded-card overflow-hidden bg-surface-2 aspect-video" />
        ))}
      </div>
      <div className="hidden xl:grid grid-cols-5 gap-4 py-1.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="animate-pulse rounded-card overflow-hidden bg-surface-2 aspect-video" />
        ))}
      </div>
      {/* Mobile: poster rail (~2.4 visible) */}
      <div className="flex gap-3 py-1.5 lg:hidden">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="w-[42%] shrink-0 animate-pulse rounded-card overflow-hidden bg-surface-2 aspect-2/3" />
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
              style={{ flex: f, backgroundColor: "var(--color-surface-0)" }}
            >
              <div className="absolute inset-y-0 left-0 bg-surface-2 animate-pulse" style={{ aspectRatio: "2/3" }} />
            </div>
          ))}
        </div>
      </div>
      {/* Mobile: poster rail */}
      <div className="flex gap-3 py-1.5 lg:hidden">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="aspect-2/3 w-[42%] shrink-0 animate-pulse rounded-card bg-surface-2" />
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
      {/* Desktop: backdrop row — py-1.5 mirrors the real row's hover-scale headroom. Same
          `cardsPerView` breakpoints as the real section (3 from lg, 5 from xl) — a flat 5 across
          the whole desktop range meant the lg-only zone (1024-1279px) showed 5 narrow cards where
          the real row shows 3 wider ones. */}
      <div className="hidden gap-4 py-1.5 lg:flex xl:hidden">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex-1 aspect-video rounded-card bg-surface-2 animate-pulse" />
        ))}
      </div>
      <div className="hidden gap-4 py-1.5 xl:flex">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex-1 aspect-video rounded-card bg-surface-2 animate-pulse" />
        ))}
      </div>
      {/* Mobile: poster rail */}
      <div className="flex gap-3 py-1.5 lg:hidden">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="aspect-2/3 w-[42%] shrink-0 rounded-card bg-surface-2 animate-pulse" />
        ))}
      </div>
    </section>
  );
}

// ─── Stats skeleton ────────────────────────────────────────────────────────────

/**
 * Measured against `StatsPage.tsx`'s own JSX, section by section — this page had the worst CLS
 * of any Watching skeleton (0.0739) and the reason wasn't a sizing rounding error: TWO WHOLE
 * SECTIONS were simply never drawn. "Your Watching Goals" and the entire `AchievementGrid` (8
 * fixed cards, always exactly 8 — `computeStats.ts` defines a static list, so this one number
 * is NOT a guess the way a row count elsewhere in this file has to be) don't exist in the old
 * skeleton at all, so real data landing didn't resize the page, it grew two new sections into
 * it. Also: every card here is `surface-card` in the real page (rim light + a soft shadow) —
 * the flat `bg-surface-1` fill the old version used is a different, quieter material.
 */
export function StatsSkeleton() {
  return (
    <div className="space-y-4 p-4 md:p-6 animate-pulse">
      {/* Year pills — "All time" + one per year the account has data for; ~14 is what this
          account currently shows. Export + Wrapped sit at the end of the same row. */}
      <div className="flex items-center gap-2">
        <div className="hidden flex-1 gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex">
          {Array.from({ length: 14 }, (_, i) => <div key={i} className="h-8 w-14 shrink-0 rounded-control bg-surface-1" />)}
        </div>
        <div className="h-9 flex-1 rounded-control bg-surface-1 sm:hidden" />
        <div className="flex shrink-0 gap-2">
          <div className="h-8 w-20 rounded-control bg-surface-1" />
          <div className="h-8 w-28 rounded-control bg-surface-1" />
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-28 rounded-card surface-card" />)}
      </div>

      {/* Your Watching Goals — present whenever a Goal is linked to this module, which for an
          active account is the common case, not the exception. */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <div className="h-3.5 w-3.5 rounded-full bg-surface-2" />
          <div className="h-4 w-36 rounded bg-surface-2" />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-card surface-card p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="h-3.5 w-28 rounded bg-surface-2" />
                <div className="h-3 w-10 rounded bg-surface-2" />
              </div>
              <div className="mt-3 h-1.5 w-full rounded-full bg-surface-2" />
              <div className="mt-2 h-2.5 w-32 rounded bg-surface-2" />
            </div>
          ))}
        </div>
      </div>

      {/* Row 2 — charts: Hours Watched (donut), Activity (bars), Rating Distribution (line) */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {[1, 2, 3].map((i) => <div key={i} className="h-60 rounded-card surface-card" />)}
      </div>

      {/* Top Picks + Top Genres */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="h-60 rounded-card surface-card" />
        <div className="h-60 rounded-card surface-card" />
      </div>

      {/* Achievements — exactly 8, always (a fixed set defined in computeStats.ts; only the
          unlocked/locked state is data). */}
      <div>
        <div className="mb-4 h-4 w-32 rounded bg-surface-2" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="rounded-xl border border-border-subtle bg-surface-1 p-4">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-lg bg-surface-2" />
              </div>
              <div className="mt-2.5 h-3.5 w-4/5 rounded bg-surface-2" />
              <div className="mt-1.5 h-2.5 w-full rounded bg-surface-2" />
            </div>
          ))}
        </div>
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
/** The hero is identical on both detail pages — one shape, so neither can drift from the other. */
function HeroSkeleton() {
  return (
    <>
      {/* ── Mobile — the real hero FLOWS: backdrop, then a centred column pulled up over it.
             The old skeleton anchored everything to the bottom of the backdrop (the desktop
             shape), so the page re-laid itself out the moment the data landed. ── */}
      <div className="lg:hidden">
        {/* The real hero is a photograph (the backdrop) under a gradient — never a flat fill.
            `bg-surface-1` (#161619) sat behind a gradient that darkens toward `surface-0`
            (#0e0e11, the PAGE background): two near-black tones a few points apart, so the
            "banner" was indistinguishable from empty page — no artwork was visibly loading at
            all. `surface-2` + `animate-pulse` is what every other piece of artwork in this file
            uses to say "an image is coming"; the hero was the one exception. */}
        <div className="relative aspect-video w-full animate-pulse overflow-hidden bg-surface-2">
          <div className="absolute inset-0 bg-linear-to-t from-surface-0 via-surface-0/30 to-transparent" />
        </div>
        <div className="relative -mt-16 flex flex-col items-center px-4 pb-2">
          <div className="aspect-2/3 w-(--poster-md) shrink-0 animate-pulse rounded-tile bg-surface-2" />
          <div className="mt-3 h-6 w-40 animate-pulse rounded-control bg-surface-2" />
          <div className="mt-3 flex gap-1.5">
            {[14, 16, 12].map((w, i) => (
              <div key={i} className="h-5 animate-pulse rounded-full bg-surface-2" style={{ width: `${w * 4}px` }} />
            ))}
          </div>
          <div className="mt-2.5 h-4 w-48 animate-pulse rounded bg-surface-2" />
          <div className="mt-3 h-14 w-full animate-pulse rounded-control bg-surface-2" />
          {/* Reserved trailer slot — same height as the real button, so nothing shifts */}
          <div className="mt-4 h-8 w-32 animate-pulse rounded-full bg-surface-2" />
        </div>
      </div>

      {/* ── Desktop — content anchored to the bottom of the banner ── */}
      <div className="relative hidden w-full animate-pulse overflow-hidden bg-surface-2 lg:block lg:aspect-21/9 lg:max-h-[55vh] lg:min-h-70">
        <div className="absolute inset-0 bg-linear-to-t from-surface-0 via-surface-0/40 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 px-10 pb-8">
          <div className="flex items-end gap-8">
            <div className="aspect-2/3 w-(--poster-xl) shrink-0 animate-pulse rounded-tile bg-surface-2" />
            <div className="flex-1 space-y-3 pb-1">
              <div className="h-7 w-2/3 animate-pulse rounded-control bg-surface-2" />
              <div className="h-4 w-1/3 animate-pulse rounded bg-surface-2" />
              <div className="h-10 w-full max-w-4xl animate-pulse rounded-control bg-surface-2" />
              <div className="h-8 w-32 animate-pulse rounded-full bg-surface-2" />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * Watch History's shape, measured off the real `SeasonHistoryStrip`: a horizontal rail that
 * NEVER wraps, at any breakpoint — `w-(--rail-peek) shrink-0 sm:w-(--poster-lg)`, same container
 * classes as the real strip. Its "S1" / year label lives baked INTO the artwork (a bottom mask),
 * not printed below it, so — unlike a poster grid tile — there is no caption row to reserve.
 *
 * The old skeleton drew this with a CSS grid (`grid-cols-3` on mobile). A grid wraps; a rail
 * scrolls. Six tiles in a 3-col grid is two full rows nobody asked for, sitting where the real
 * page shows one row of ~2.4 cards trailing off the right edge — a different shape, not just a
 * placeholder waiting to be resized.
 */
function WatchHistorySkeleton({ w, n }: { w: string; n: number }) {
  return (
    <div>
      <div className={`mb-3 h-4 animate-pulse rounded bg-surface-2 ${w}`} />
      <div className="-mx-4 flex gap-3 overflow-x-auto scroll-px-4 px-4 py-1.5 scrollbar-hide sm:mx-0 sm:px-0">
        {Array.from({ length: n }, (_, j) => (
          <div
            key={j}
            className="aspect-2/3 w-(--rail-peek) shrink-0 animate-pulse rounded-tile bg-surface-2 sm:w-(--poster-lg)"
          />
        ))}
      </div>
    </div>
  );
}

/**
 * More Like This's shape, measured off the real component: a poster rail that SCROLLS on mobile
 * (`w-(--rail-peek)`, one row) and becomes a CSS grid from `sm:` up (`sm:grid-cols-4 lg:grid-cols-6`)
 * — container and item classes copied verbatim from `MoreLikeThis.tsx` so the two cannot drift.
 * Unlike Watch History, the title + year print BELOW the artwork here, so each tile reserves that
 * two-line caption too (measured: without it the block stood ~55px short per row).
 */
function MoreLikeThisSkeleton({ w, n }: { w: string; n: number }) {
  return (
    <div>
      <div className={`mb-3 h-4 animate-pulse rounded bg-surface-2 ${w}`} />
      <div className="-mx-4 flex gap-3 overflow-x-auto scroll-px-4 px-4 py-1 scrollbar-hide sm:mx-0 sm:grid sm:grid-cols-4 sm:overflow-visible sm:px-0 lg:grid-cols-6">
        {Array.from({ length: n }, (_, j) => (
          <div key={j} className="w-(--rail-peek) shrink-0 sm:w-auto">
            <div className="aspect-2/3 animate-pulse rounded-tile bg-surface-2" />
            <div className="mt-2 h-3 w-4/5 animate-pulse rounded-control bg-surface-2" />
            <div className="mt-1 h-2.5 w-1/3 animate-pulse rounded-control bg-surface-2" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Episodes' shape: a heading, then the real `EpisodeCardsSkeleton` (still + number + title +
 * two-line overview) — the SAME cards `Episodes.tsx` shows for its own `isLoading` state, so the
 * page never swaps a bare image tile for a fuller card the instant that component mounts.
 *
 * ⚠️ Known gap, not silently absorbed: the real section also shows a row of season chips (S1 S2
 * S3…) between the heading and the cards, and this can't reserve that row — season COUNT isn't
 * known until the title itself loads. That costs a small (~30-50px), one-time settle once the row
 * lands; the alternative (guessing a season count) would be wrong at least as often as it's right.
 */
function EpisodesSectionSkeleton({ n = 4 }: { n?: number }) {
  return (
    <div>
      <div className="mb-3 h-4 w-24 animate-pulse rounded bg-surface-2" />
      <EpisodeCardsSkeleton n={n} />
    </div>
  );
}

/**
 * The label/value rows `QuickStats` and `MediaDetails` are both built from (`DetailRow` / `Row` —
 * same shape, two names). Real row count is DATA-DEPENDENT (OMDb coverage is patchy — see the
 * Episodes header comment on `HEATMAP_ENABLED`), so this cannot be pixel-exact the way a rail
 * tile can: `rows` picks a plausible typical count (measured against House of the Dragon's Quick
 * Stats = 6 rows / 288px, Details = 7 rows + an awards line / 434px), not the true one. It is
 * still a label/value LIST reserving list-shaped height, not one blank rectangle standing in for
 * a panel that in reality never stops growing past it.
 */
function DetailRowsSkeleton({ titleW, rows, withBadge, withAwards }: { titleW: string; rows: number; withBadge?: boolean; withAwards?: boolean }) {
  return (
    <div className="surface-quiet rounded-card">
      <div className="flex items-center justify-between gap-3 px-4 pb-3 pt-4 sm:px-5">
        <div className={`h-4 animate-pulse rounded bg-surface-2 ${titleW}`} />
        {withBadge && <div className="h-5 w-11 animate-pulse rounded-chip bg-surface-2" />}
      </div>
      {withAwards && (
        <div className="flex items-start gap-2.5 border-b border-border-subtle px-4 py-3 sm:px-5">
          <div className="mt-0.5 h-4 w-4 shrink-0 animate-pulse rounded-full bg-surface-2" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="h-3.5 w-2/3 animate-pulse rounded bg-surface-2" />
            <div className="h-3 w-1/3 animate-pulse rounded bg-surface-2" />
          </div>
        </div>
      )}
      <div className="px-4 pb-4 sm:px-5 sm:pb-5">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-baseline justify-between gap-4 border-b border-border-subtle py-2.5 last:border-0">
            <div className="h-3 w-20 animate-pulse rounded bg-surface-2" />
            <div className="h-3 w-14 animate-pulse rounded bg-surface-2" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * My Take, measured against the real card (`Panel` + `RatingPicker`, `showValue={false}`):
 * numeral row → rating scale (a grab band PLUS a row of anchor words under it — 76px together,
 * not the 8px sliver the old skeleton reserved) → rule → a note in the real `leading-7` line
 * height. `surface-quiet` because that's Panel's actual material — the old `surface-card` is a
 * real, DIFFERENT utility (an extra floating drop-shadow) borrowed from the wrong component.
 */
function MyTakeSkeleton() {
  return (
    <div className="surface-quiet rounded-card p-4 pt-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <div className="h-9 w-14 animate-pulse rounded bg-surface-2" />
          <div className="h-4 w-10 animate-pulse rounded bg-surface-2" />
          <div className="h-4 w-16 animate-pulse rounded bg-surface-2" />
        </div>
        <div className="space-y-1.5">
          <div className="ml-auto h-3 w-36 animate-pulse rounded bg-surface-2" />
          <div className="ml-auto h-3 w-24 animate-pulse rounded bg-surface-2" />
        </div>
      </div>

      {/* Rating scale — grab band (track + ticks) then the anchor-word row under it. */}
      <div className="mt-3 max-w-2xl">
        <div className="py-3">
          <div className="h-2.5 w-full animate-pulse rounded-full bg-surface-2" />
          <div className="mt-1 h-1.5 w-full animate-pulse rounded-full bg-surface-2 opacity-30" />
        </div>
        <div className="mt-1 h-7 animate-pulse rounded bg-surface-2 opacity-20" />
      </div>

      <div className="my-4 h-px bg-border-subtle" />

      {/* Note — real text runs at `leading-7` (28px/line); a shorter bar undercounts every line. */}
      <div className="space-y-2">
        <div className="h-7 w-full animate-pulse rounded bg-surface-2" />
        <div className="h-7 w-3/4 animate-pulse rounded bg-surface-2" />
      </div>
    </div>
  );
}

/**
 * THE OWNED FICHE — hero, your verdict, your rails, your status card.
 *
 * `isSeries` is OPTIONAL and that is deliberate: this page's route carries only an id, so the type
 * is unknown until the row lands. Rather than guess (a wrong guess costs a visible re-layout, which
 * is the exact fault we are removing), the type-specific rails are simply ABSENT until we know. They
 * then appear BELOW what you are already reading, which shifts nothing above them.
 *
 * ⚠️ Known, accepted gap: on a SERIES this still means two whole rails (Watch History, Episodes)
 * insert themselves between My Take and Cast & Crew the moment the row resolves — a real shift,
 * not a rounding error. Defaulting to "it's a series" instead was considered and rejected: Watch
 * History alone needs multiple seasons AND an in-progress/watched/paused/dropped status to show at
 * all, so guessing it would be wrong for plenty of real series too (any freshly-added or single-
 * season one). In practice this mostly hits a cold/direct load — `usePrefetchMedia` warms the row
 * on hover before the click lands, so most navigations never sit on this skeleton long enough to
 * notice. Fixing it for real means knowing the type before the row does (e.g. carrying it from
 * wherever the click came from) — a data-flow change, not a drawing one, and out of this pass.
 */
export function DetailSkeleton({ isSeries }: { isSeries?: boolean } = {}) {
  return (
    <div className="min-h-screen bg-surface-0">
      <HeroSkeleton />

      <div className="relative z-10 grid grid-cols-1 lg:-mt-6 lg:grid-cols-[2fr_1fr]">
        {/* Left — My Take, then the rails. My Take is a CARD WITH NO HEADING (the score is its
            title) whose shape is: big numeral → rating scale → rule → note. */}
        <div className="min-w-0 space-y-5 px-4 py-6 lg:space-y-6 lg:py-8 lg:pl-8 lg:pr-2">
          <MyTakeSkeleton />

          {/* Only a series has a Watch History and an Episodes rail. */}
          {isSeries && <WatchHistorySkeleton w="w-32" n={6} />}
          {isSeries && <EpisodesSectionSkeleton />}
          <CastCrewSkeleton />
          <MoreLikeThisSkeleton w="w-36" n={6} />
        </div>

        {/* Rail — the branded status card leads, then the quiet blocks */}
        <div className="min-w-0 space-y-5 px-4 py-6 lg:space-y-6 lg:py-8 lg:pl-2 lg:pr-8">
          <div className="h-52 animate-pulse rounded-card bg-surface-2" />
          {/* Quick Stats is series-only — `QuickStats.tsx` returns null outright on a film. Drawing
              it unconditionally here (found by screenshotting an owned FILM, not a series) meant a
              whole extra panel appeared for every film's skeleton and then had to vanish the moment
              the row confirmed it was a film — inventing a shift the real page never has. Same
              `isSeries &&` gate as Watch History/Episodes on the left, same reason. */}
          {isSeries && <DetailRowsSkeleton titleW="w-24" rows={6} />}
          <DetailRowsSkeleton titleW="w-16" rows={7} withBadge withAwards />
          <div>
            <div className="mb-3 h-4 w-14 animate-pulse rounded bg-surface-2" />
            {/* Matches InList's OWN `isLoading` shape (`h-44 w-2/3`) — the full-page skeleton is
                gone before InList mounts, so the honest target is what InList shows itself while
                ITS queries are still in flight, not a guess at its (data-dependent) resolved size. */}
            <div className="h-44 w-2/3 animate-pulse rounded-tile bg-surface-1" />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * THE GUEST PAGE — a title you don't own. Same hero, and then a different page entirely: no verdict,
 * no history, no status card. Reusing `DetailSkeleton` here promised four panels that never arrive.
 *
 * ⚠️ THE ORDER FLIPS WITH THE TYPE, and that is the whole reason this takes a parameter: a series
 * leads with its Episodes rail (16:9 stills), a film leads with Cast & Crew (round faces). Drawing
 * one and delivering the other is a re-layout wearing a placeholder's clothes.
 *
 * Unlike the owned fiche, the type is KNOWN here — it is in the route (`/discover/[type]/[tmdbId]`),
 * so there is nothing to guess.
 */
export function DiscoverSkeleton({ isSeries }: { isSeries: boolean }) {
  const cast = <CastCrewSkeleton />;
  const episodes = <EpisodesSectionSkeleton />;

  return (
    <div className="min-h-screen bg-surface-0">
      <HeroSkeleton />

      <div className="relative z-10 grid grid-cols-1 lg:-mt-6 lg:grid-cols-[2fr_1fr]">
        <div className="min-w-0 space-y-5 px-4 py-6 lg:space-y-6 lg:py-8 lg:pl-8 lg:pr-2">
          {isSeries ? episodes : cast}
          {isSeries ? cast : null}
          <MoreLikeThisSkeleton w="w-36" n={6} />
        </div>

        <div className="min-w-0 space-y-5 px-4 py-6 lg:space-y-6 lg:py-8 lg:pl-2 lg:pr-8">
          {/* "Not in your library": a title, a line of copy, then the add buttons — three for a
              series (Want / Start / Watched), two for a film (no "Start watching"). Same material
              as the real card: `Panel` renders `surface-quiet`, not `surface-card`. */}
          <div className="surface-quiet rounded-card p-4">
            <div className="h-4 w-36 animate-pulse rounded bg-surface-2" />
            <div className="mt-3 h-3 w-full animate-pulse rounded bg-surface-2" />
            <div className="mt-1.5 h-3 w-2/3 animate-pulse rounded bg-surface-2" />
            <div className="mt-3 space-y-2.5">
              {Array.from({ length: isSeries ? 3 : 2 }, (_, i) => (
                <div key={i} className="h-8 w-full animate-pulse rounded-control bg-surface-2" />
              ))}
            </div>
          </div>
          <DetailRowsSkeleton titleW="w-16" rows={7} withBadge withAwards />
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
            <Pulse className="h-9 w-10 rounded-chip bg-surface-2" />
            <Pulse className="h-9 w-14 rounded-chip bg-surface-2" />
            <Pulse className="h-9 w-16 rounded-chip bg-surface-2" />
            <Pulse className="h-9 w-16 rounded-chip bg-surface-2" />
          </div>
          {/* Search, status FilterSelect, sort FilterSelect, Add — four controls in the real
              toolbar. A 3-box guess here meant a whole dropdown popped into existence next to the
              others once LibraryClient mounted. */}
          <div className="ml-auto flex items-center gap-2">
            <Pulse className="h-9 w-56 rounded-control bg-surface-2" />
            <Pulse className="h-9 w-36 rounded-control bg-surface-2" />
            <Pulse className="h-9 w-32 rounded-control bg-surface-2" />
            <Pulse className="h-9 w-20 rounded-control bg-surface-2" />
          </div>
        </div>
        {/* Mobile: select + add  /  search + sort */}
        <div className="space-y-2 sm:hidden">
          <div className="flex items-center gap-2">
            <Pulse className="h-9 w-28 rounded-control bg-surface-2" />
            <Pulse className="ml-auto h-9 w-9 rounded-control bg-surface-2" />
          </div>
          <div className="flex items-center gap-2">
            <Pulse className="h-9 flex-1 rounded-control bg-surface-2" />
            <Pulse className="h-9 w-32 rounded-control bg-surface-2" />
          </div>
        </div>
        {/* count */}
        <Pulse className="h-3 w-16 bg-surface-2" />
      </div>

      {/* Grid */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-3">
        {Array.from({ length: 20 }).map((_, i) => (
          <div key={i} className="animate-pulse space-y-2">
            <Pulse className="aspect-2/3 w-full bg-surface-2 rounded-card" />
            <Pulse className="h-3 w-3/4 bg-surface-2" />
            <Pulse className="h-3 w-1/2 bg-surface-2" />
          </div>
        ))}
      </div>
    </div>
  );
}
