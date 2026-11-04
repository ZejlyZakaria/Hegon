"use client";

import { useRef, useState, useEffect } from "react";
import { SectionImageReveal } from "./SectionImageReveal";
import { CarouselSkeleton } from "./WatchingSkeletons";
import { useRouter } from "next/navigation";
import { usePrefetchMedia } from "../../hooks/usePrefetchMedia";
import Image from "next/image";
import { tmdbImageFor, tmdbImageSrcSet } from "../../lib/tmdb-image";
import { Plus } from "lucide-react";
import type { WatchingMedia } from "@/modules/watching/types";
import { cn } from "@/shared/utils/utils";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { CarouselNav } from "@/shared/components/ui/carousel-nav";
import { SectionHeader } from "@/shared/components/ui/section-header";
import { LoveMark, WatchlistMark, TopTenRibbon, ScoreMark, OVERLAY_CLUSTER, OVERLAY_CIRCLE } from "@/modules/watching/components/shared/Marks";
import { StatusMark, watchlistLevel } from "@/modules/watching/components/shared/StatusBadge";
import { WATCHING_ACCENT } from "@/modules/watching/ui";

// The watchlist bookmark: one object for "on your list", its colour is the priority.
// See Marks.tsx — the reasoning lives with the grammar, not here.
import { displayTitle, watchedAgo, releaseCountdown } from "@/modules/watching/utils";
import { Clock, CalendarClock } from "lucide-react";
import { isAwaitingNextSeason, latestViewingAt } from "@/modules/watching/lib/series-state";
import { formatPosition, overallProgress } from "@/modules/watching/lib/progress";
import { useMediaViews } from "@/modules/watching/hooks/useMediaView";
import type { MediaView } from "@/modules/watching/lib/media-view";
import { NextEpisodeButton } from "./NextEpisodeButton";
import { MediaActionMenu } from "./MediaActionMenu";

// ─── types ────────────────────────────────────────────────────────────────────

type MediaCarouselProps = {
  title: string;
  subtitle?: string;
  items: WatchingMedia[];
  onAddClick?: () => void;
  /** The rail is a window on a bigger list — this opens the whole of it. */
  onSeeAll?: () => void;
  onDelete?: (itemId: string) => Promise<void>;
  showEpisodeBadge?: boolean;
  showRankBadge?: boolean;
  /** Recently Watched only — surface WHEN you watched it, the ordering made legible. */
  showWatchedAgo?: boolean;
  /** Waiting for only — surface WHEN a film comes out, the anticipation made legible. */
  showCountdown?: boolean;
  /** Last Watched only — flag a caught-up title (up to date, not finished) with a consumption-status badge. */
  showCaughtUp?: boolean;
  /**
   * The Museum's rail: a mark on the artwork (the gold year tag, which positions itself) INSTEAD
   * of the priority / Top 10 ribbons, and a line under the title (the category) INSTEAD of the
   * genres. Render props rather than two more `show*` flags: the card does not know what an award is.
   */
  mark?: (item: WatchingMedia) => React.ReactNode;
  meta?: (item: WatchingMedia) => React.ReactNode;
  /** Extra controls in the header, BEFORE the arrows (the Museum's Oscars | Emmys switch). */
  actions?: React.ReactNode;
};


// ─── movie card ───────────────────────────────────────────────────────────────

function MovieCard({
  item,
  view,
  onView,
  onIntent,
  onDelete,
  showEpisodeBadge,
  showRankBadge,
  showWatchedAgo,
  showCountdown,
  showCaughtUp,
  orientation = "backdrop",
  mark,
  meta,
}: {
  item: WatchingMedia;
  /** The lens. Without it a lumped anime prints its FLAT episode ("S01 E59") on the tile while its
   *  own detail page says "S03 E12" — the same position, two different sentences. */
  view?: MediaView | null;
  onView: () => void;
  /** Hover/focus = intent. Warms the fiche's query before the click — see usePrefetchMedia. */
  onIntent?: () => void;
  onDelete?: (id: string) => Promise<void>;
  showEpisodeBadge?: boolean;
  showRankBadge?: boolean;
  showWatchedAgo?: boolean;
  showCountdown?: boolean;
  showCaughtUp?: boolean;
  orientation?: "poster" | "backdrop";
  mark?: (item: WatchingMedia) => React.ReactNode;
  meta?: (item: WatchingMedia) => React.ReactNode;
}) {
  const isPoster = orientation === "poster";
  const caughtUp = !!showCaughtUp && isAwaitingNextSeason(item);
  // Compact on the narrow poster (mobile): "2w" instead of "2 weeks ago", which crowds the tile.
  // The same consumption date orders the rail and labels every title, including Caught Up.
  const ago = showWatchedAgo ? watchedAgo(latestViewingAt(item), { short: isPoster }) : null;
  // "Waiting for" cards: the countdown to release. Legacy rows with no stored date still belong here
  // (via status) but can't count — they say "Soon" rather than nothing.
  const countdown = showCountdown ? (releaseCountdown(item.release_date, { short: isPoster }) ?? "Soon") : null;

  return (
    <div
      // origin-bottom: the whole card still scales (the pop you like), but it grows FROM the bottom
      // edge — so the bottom row (categories, rating) stays anchored instead of sliding down.
      className={cn("group relative w-full cursor-pointer origin-bottom transition-transform duration-300 ease-out hover:z-10 hover:scale-[1.04]", isPoster ? "rounded-tile" : "rounded-card")}
      onClick={onView}
      onMouseEnter={onIntent}
      onFocus={onIntent}
    >
      {/* overflow-hidden only on the image container so the dropdown can escape */}
      <div className={cn("relative overflow-hidden bg-zinc-800", isPoster ? "rounded-tile aspect-2/3" : "rounded-card aspect-video")}>
        {/**
         * ASK FOR THE SIZE THIS CARD SHOWS. A poster tile is ~160px wide and a backdrop card ~340px;
         * the stored urls said `w500` and `original` (avg 603 KB, several thousand pixels). That one
         * mismatch was 20.6 of the 22.4 MB this page used to download.
         *
         * The optimizer is disabled globally. Native picture candidates select density at the CDN;
         * a sizes prop alone cannot make an unoptimized Image responsive.
         */}
        <picture>
          <source srcSet={tmdbImageSrcSet(isPoster ? item.poster_url || item.backdrop_url : item.backdrop_url || item.poster_url,isPoster ? 170:360,isPoster ? 500:item.backdrop_url ? 1280:780)} />
          <Image
            src={
              (isPoster
                ? tmdbImageFor(item.poster_url || item.backdrop_url, 170)
                : tmdbImageFor(item.backdrop_url || item.poster_url, 360)) || "/placeholder.svg"
            }
            alt={item.title}
            fill
            // scale-[1.02]: overscan by ~1% each side so the art always covers the container to the
            // pixel. A `fill` image can fall a sub-pixel short of the rounded edge, letting the
            // `bg-zinc-800` behind it show as a 1px hairline ("le trait") at the bottom. Overscanning
            // leaves no gap for it; the overflow-hidden clips the excess so nothing shows.
            className="object-cover scale-[1.02]"
            sizes={isPoster ? "(max-width: 1024px) 45vw, 180px" : "(max-width: 1024px) 45vw, 380px"}
            loading="lazy"
          />
        </picture>
        <div className="absolute inset-0 bg-linear-to-t from-black/85 via-black/30 to-transparent" />
        {caughtUp && <div aria-hidden="true" className="watching-status-mask" />}

        {/* THE ONE THING OUTSIDE THE CLUSTERS, and it earns it: a bookmark is a RIBBON, and a ribbon
            hangs from an edge. Held at the cluster's inset it floated in the corner and stopped
            reading as a bookmark at all. Flush to the top, then — but not to the left: the card is
            `rounded-card` (12px), and at 0 the glyph would sit half on the curve. */}
        {/* A caller's mark (the shelf's year tag) joins the left cluster as its first item, so the
            heart sits to its RIGHT instead of over it (owner, 2026-09-17); the cluster then starts
            at the card's edge, where a tag that hangs from the edge belongs. */}
        {!mark && item.want_to_watch && !showCountdown && (
          <div className="absolute left-2 top-0 z-10">
            <WatchlistMark level={watchlistLevel(item)} />
          </div>
        )}
        {/* The Top 10 ribbon hangs from the same edge, for the same reason — with the RANK, since
            this rail IS the ranking. */}
        {!mark && showRankBadge && item.priority && (
          <div className="absolute left-2 top-0 z-10">
            <TopTenRibbon rank={item.priority} size="carousel" />
          </div>
        )}

        {/* THE OVERLAY GRAMMAR — two clusters, and nothing else may sit on the artwork:
            left = IDENTITY (what this title is: rank, priority), right = ACTIONS (favorite,
            menu). Same inset, same 24px item height, same gap → they align by construction
            instead of by three separate `top-2` / `top-3` guesses. */}
        <div className={cn(OVERLAY_CLUSTER, mark ? "left-0" : showRankBadge && item.priority ? "left-9" : item.want_to_watch && !showCountdown ? "left-7" : "left-2")}>
          {mark?.(item)}
          {/* Priority is "how badly do I want to watch this" — meaningless for a film that isn't out
              yet. In the Waiting for rail (showCountdown) the countdown is the only mark that belongs. */}
          {/* WHEN you watched it — a factual timestamp, not a verdict, so it's neutral white, not
              the teal of a rating or the gold of the world. It has this cluster to itself: rank and
              priority never apply to a watched title. */}
          {ago && (
            <Badge variant="flag" size="sm" color="rgba(255,255,255,0.92)" className="watching-time-label">
              <Clock size={11} />
              {ago}
            </Badge>
          )}
          {/* Time until release — a world fact about the future, so neutral white like the watched-ago
              stamp, not the teal of something that's yours yet. */}
          {countdown && (
            <Badge variant="flag" size="sm" color="rgba(255,255,255,0.92)" className="watching-time-label">
              <CalendarClock size={11} />
              {countdown}
            </Badge>
          )}
        </div>

        <div className="absolute bottom-0 inset-x-0 p-4">
          <div className="flex min-w-0 items-center gap-2">
            <h4 className="min-w-0 flex-1 text-sm font-semibold text-white">
              <button type="button" onClick={e=>{e.stopPropagation();onView();}} className="block max-w-full truncate text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-watching-vivid">{displayTitle(item)}</button>
            </h4>
            {caughtUp && <StatusMark status={{ label: "Caught up", tone: "caughtup", level: null }} />}
          </div>

          {/* Episode progress — and, beside it, the way to move it. The card has always known
              you were on S03 E03; it just wouldn't let you say you'd watched E04, so the most
              frequent gesture in the app cost four taps and a page load.

              The chip and the button are forced to the SAME 24px height (h-6). The chip was a
              hand-rolled span with its own padding, so it sat a few pixels off the button beside
              it — the same mechanical mismatch that made the List Detail toolbar look "off". A
              row aligns when its items share a height, not when you nudge them. */}
          {showEpisodeBadge &&
            // "HAVE YOU STARTED THIS AT ALL?" — a question about existence, not about location, and
            // its answer is the same in both spaces: a position past zero is past zero whether you
            // call it episode 59 or S03 E12. Reading the lens here would also make the badge appear
            // and disappear while the cours resolve, which is what `pending` exists to prevent.
            // eslint-disable-next-line no-restricted-syntax -- space-invariant "is there a position at all" test, not a coordinate to display.
            ((item.current_episode ?? 0) > 0 || (item.current_season ?? 1) > 1) && (
              <div className="space-y-1.5">
                {/* flex-wrap: on a narrow mobile poster, the position chip + a wide state chip
                    ("Caught up") overflowed the card edge. They now stack instead of spilling. */}
                <div className="flex flex-wrap items-center gap-2">
                  {/* Nothing until the lens is resolved. Showing the flat position and correcting it
                      a beat later meant the card visibly changed its mind — an anime read "S01 E59"
                      then "S03 E12". No position is honest; a retracted one is not. */}
                  {!view?.pending && (
                  <span
                    data-tone="position"
                    data-size="compact"
                    className="watching-status shrink-0 text-caption tabular-nums"
                  >
                    {/* eslint-disable-next-line no-restricted-syntax -- lens first; the raw values are the fallback for a title with no overlay, where they ARE the display space. */}
                    {formatPosition(view?.position.season ?? item.current_season ?? 1, view?.position.episode ?? item.current_episode ?? 0)}
                  </span>
                  )}
                  <span onClick={(e) => e.stopPropagation()}>
                    <NextEpisodeButton item={item} view={view} />
                  </span>
                </div>
                {overallProgress(item) > 0 && (
                  <div className="h-0.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${overallProgress(item)}%`,
                        backgroundColor: "var(--color-accent-watching-vivid)",
                      }}
                    />
                  </div>
                )}
              </div>
            )}

          <div className="mt-1.5 flex min-w-0 items-center gap-2">
            {/* `truncate` on the Badge itself did nothing: the badge is an inline-flex box, and
                text-overflow only applies to the element that HOLDS the text. So the label gets
                its own span — "Science Fiction" ellipsises instead of shoving the year and the
                score off the card. */}
            {/* Genres via the primitive, at the weight this surface can carry. The earlier note
                here was half right: `overlay` DID read louder than the title — but because it was
                being handed the hero's 0.8 white, not because the variant is wrong. A genre is
                metadata; it must sit under the title that names the thing. This card's title is
                `text-sm`, so the pill is quieter than the hero's and matches Don't Miss. */}
            {meta ? meta(item) : !isPoster && item.tags?.slice(0, 2).map((tag) => (
              <Badge key={tag} variant="overlay" size="sm" color="rgba(255,255,255,0.45)" className="min-w-0 max-w-24 shrink">
                <span className="truncate">{tag}</span>
              </Badge>
            ))}
            {/* A custom meta line owns the row: on the trophy shelf the release year sat next to a
                ceremony-year tag (2025 under a "2026" ribbon) and read as a contradiction. */}
            {!meta && <span className="shrink-0 text-xs text-text-tertiary">{item.year}</span>}

            {/* YOUR rating → teal star. It used to be gold, which is the WORLD's colour —
                the same mark meant two different things depending on the screen. */}
            {item.user_rating != null && item.user_rating > 0 && (
              <ScoreMark value={item.user_rating} source="mine" className="shrink-0" />
            )}
          </div>
        </div>
      </div>

      {/* Right cluster = ACTIONS, and only actions. (MediaActionMenu portals its dropdown, so no
          overflow clip.) */}
      <div className={cn(OVERLAY_CLUSTER, "right-2")} onClick={(e) => e.stopPropagation()}>
        {/* The heart sits beside the menu, on the right (owner, 2026-09-17) — the left cluster is
            the ribbon's and the states'. */}
        {item.favorite && !(showRankBadge && item.priority) && (
          <span className={OVERLAY_CIRCLE}>
            <LoveMark size={12} />
          </span>
        )}
        {/* ONE CLOCK. The card scales over 300 ms; the menu used to appear over 150 — two curves on
            one gesture, and the mark visibly 'arrived' before the card had settled. Same duration,
            same easing: the menu is part of the card, it moves with it. */}
        <span className="opacity-100 transition-opacity duration-300 ease-out can-hover:opacity-0 can-hover:group-hover:opacity-100">
          <MediaActionMenu item={item} view={view} onView={onView} onDelete={onDelete} />
        </span>
      </div>
    </div>
  );
}

// ─── main ─────────────────────────────────────────────────────────────────────

export function MediaCarousel({
  title,
  subtitle,
  items,
  onAddClick,
  onSeeAll,
  onDelete,
  showEpisodeBadge = false,
  showRankBadge = false,
  showWatchedAgo = false,
  showCountdown = false,
  showCaughtUp = false,
  mark,
  meta,
  actions,
}: MediaCarouselProps) {
  const router = useRouter();
  const prefetch = usePrefetchMedia();
  // Add IS shown in the read-only demo — clicking it runs the full add flow, then
  // the guarded mutation shows the friendly read-only toast.
  const canAdd = !!onAddClick;
  const scrollRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [cardsPerView, setCardsPerView] = useState(5);
  const prevFirstIdRef = useRef<string | null>(null);
  const gap = 16;
  // One batched read for the whole rail, then a lens per card — the overlay costs a single query,
  // not one per tile.
  const views = useMediaViews(items);

  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;
      if (w < 768) setCardsPerView(1);
      else if (w < 1024) setCardsPerView(2);
      else if (w < 1280) setCardsPerView(3);
      else setCardsPerView(5);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // NO client-side re-sort. Each section already arrives in the order it MEANS: Recently Watched by
  // watched_at, Top Rated by rank, In Progress by recency. A blanket `sort by priority` here quietly
  // overrode all of them — it shoved every Top-10 title to the front of Recently Watched (Chernobyl,
  // rank 3, jumped above Arcane despite being watched a year earlier). The server's order is the
  // truth; we keep it.
  const sortedItems = items;

  // Auto-scroll back to the start when a NEW item takes position 1 — covers both
  // adding (Want to Watch) AND a freshly-watched title entering Recently Watched
  // (which is length-capped, so a length check wouldn't fire).
  useEffect(() => {
    const firstId = sortedItems[0]?.id ?? null;
    if (prevFirstIdRef.current !== null && firstId && firstId !== prevFirstIdRef.current) {
      const frame = requestAnimationFrame(() => {
        setCurrentIndex(0);
        scrollRef.current?.scrollTo({ left: 0, behavior: "smooth" });
      });
      prevFirstIdRef.current = firstId;
      return () => cancelAnimationFrame(frame);
    }
    prevFirstIdRef.current = firstId;
  }, [sortedItems]);

  const totalElements = sortedItems.length;
  const canGoPrev = currentIndex > 0;
  const canGoNext = currentIndex < totalElements - cardsPerView;

  const scroll = (direction: "prev" | "next") => {
    if (!scrollRef.current) return;
    const containerWidth = scrollRef.current.clientWidth;
    const cardWidth =
      (containerWidth - (cardsPerView - 1) * gap) / cardsPerView;
    let newIndex = currentIndex;
    if (direction === "prev" && canGoPrev) newIndex--;
    else if (direction === "next" && canGoNext) newIndex++;
    scrollRef.current.scrollTo({
      left: newIndex * (cardWidth + gap),
      behavior: "smooth",
    });
    setCurrentIndex(
      Math.min(newIndex, Math.max(0, totalElements - cardsPerView)),
    );
  };

  const itemWidthStyle = {
    width: "calc((100% - (var(--hub-cards) - 1) * 16px) / var(--hub-cards))",
  };

  if (items.length === 0) {
    return (
      <section>
        <div className="mb-1.5 flex items-center justify-between">
          <div>
            <h3 className="text-title text-text-primary">
              {title}
            </h3>
            {subtitle && (
              <p className="mt-1 text-xs text-text-tertiary">{subtitle}</p>
            )}
          </div>
        </div>
        <div
          className={cn(
            "rounded-card border border-border-subtle bg-surface-1 flex flex-col items-center justify-center gap-3 py-12 transition-colors",
            canAdd && "cursor-pointer group hover:border-border-default",
          )}
          onClick={canAdd ? onAddClick : undefined}
        >
          {canAdd ? (
            <>
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/5 group-hover:bg-white/10 transition-colors">
                <Plus
                  size={22}
                  className="text-text-tertiary group-hover:text-text-secondary transition-colors"
                />
              </div>
              <p className="text-sm text-text-tertiary group-hover:text-text-secondary transition-colors">
                Add your first item
              </p>
            </>
          ) : (
            <p className="text-sm text-text-tertiary">Nothing here yet</p>
          )}
        </div>
      </section>
    );
  }

  return (
    <SectionImageReveal fallback={<CarouselSkeleton title={title} subtitle={subtitle} add={canAdd} seeAll={!!onSeeAll} />}>
    <section>
      <SectionHeader
        title={title}
        subtitle={subtitle}
        actions={
          <>
            {actions}
            <CarouselNav
              className="hidden lg:flex"
              onPrev={() => scroll("prev")}
              onNext={() => scroll("next")}
              canPrev={canGoPrev}
              canNext={canGoNext}
            />
            {onSeeAll && (
              <Button variant="quiet" size="sm" onClick={onSeeAll}>
                See all
              </Button>
            )}
            {canAdd && (
              <Button variant="accent" size="sm" style={WATCHING_ACCENT} onClick={onAddClick}>
                <Plus />
                Add
              </Button>
            )}
          </>
        }
      />

      <div
        ref={scrollRef}
        className="[--hub-cards:3] xl:[--hub-cards:5] hidden lg:flex gap-4 overflow-x-auto scroll-smooth snap-x snap-mandatory py-3 -mx-4 px-4 scroll-px-4 sm:-mx-6 sm:px-6 sm:scroll-px-6"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {sortedItems.map((item) => (
          <div
            key={item.id}
            className="shrink-0 snap-start"
            style={itemWidthStyle}
          >
            <MovieCard
              item={item}
              view={views.get(item.id)}
              onView={() => router.push(`/perso/watching/${item.id}`)}
              onIntent={() => prefetch(item.id)}
              onDelete={onDelete}
              showEpisodeBadge={showEpisodeBadge}
              showRankBadge={showRankBadge}
              showWatchedAgo={showWatchedAgo}
              showCountdown={showCountdown}
              showCaughtUp={showCaughtUp}
              mark={mark}
              meta={meta}
            />
          </div>
        ))}
      </div>

      {/* Mobile: native poster rail. Both responsive trees stay lazy at mount;
          the section gate warms only the visible tree and its next viewport. */}
      <div className="flex lg:hidden gap-3 overflow-x-auto custom-scrollbar-hide snap-x snap-mandatory py-1.5">
        {sortedItems.map((item) => (
          <div
            key={item.id}
            className="w-[42%] md:w-[28%] shrink-0 snap-start"
          >
            <MovieCard
              orientation="poster"
              item={item}
              view={views.get(item.id)}
              onView={() => router.push(`/perso/watching/${item.id}`)}
              onIntent={() => prefetch(item.id)}
              onDelete={onDelete}
              showEpisodeBadge={showEpisodeBadge}
              showRankBadge={showRankBadge}
              showWatchedAgo={showWatchedAgo}
              showCountdown={showCountdown}
              showCaughtUp={showCaughtUp}
              mark={mark}
              meta={meta}
            />
          </div>
        ))}
      </div>
    </section>
    </SectionImageReveal>
  );
}
