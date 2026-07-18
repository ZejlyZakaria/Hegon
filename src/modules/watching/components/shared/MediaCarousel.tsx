"use client";

import { useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import type { WatchingMedia } from "@/modules/watching/types";
import { cn } from "@/shared/utils/utils";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { CarouselNav } from "@/shared/components/ui/carousel-nav";
import { SectionHeader } from "@/shared/components/ui/section-header";
import { LoveMark, RankMark, ScoreMark, OVERLAY_CLUSTER, OVERLAY_CIRCLE } from "@/modules/watching/components/shared/Marks";
import { WATCHING_ACCENT } from "@/modules/watching/ui";

// Priority on a want-to-watch: a WORD, not a cryptic bookmark. Red/amber/neutral = urgency,
// a scale everyone already reads.
const PRIORITY_COLOR: Record<string, string> = {
  high: "#fb7185",
  medium: "#fcd34d",
  low: "rgba(255,255,255,0.75)",
};
import { displayTitle, watchedAgo, releaseCountdown } from "@/modules/watching/utils";
import { Clock, CalendarClock } from "lucide-react";
import { formatPosition, overallProgress } from "@/modules/watching/lib/progress";
import { NextEpisodeButton } from "./NextEpisodeButton";
import { MediaActionMenu } from "./MediaActionMenu";

// ─── types ────────────────────────────────────────────────────────────────────

type MediaCarouselProps = {
  title: string;
  subtitle?: string;
  items: WatchingMedia[];
  onAddClick?: () => void;
  onDelete?: (itemId: string) => Promise<void>;
  showEpisodeBadge?: boolean;
  showRankBadge?: boolean;
  /** Recently Watched only — surface WHEN you watched it, the ordering made legible. */
  showWatchedAgo?: boolean;
  /** Waiting for only — surface WHEN a film comes out, the anticipation made legible. */
  showCountdown?: boolean;
};


// ─── movie card ───────────────────────────────────────────────────────────────

function MovieCard({
  item,
  onView,
  onDelete,
  showEpisodeBadge,
  showRankBadge,
  showWatchedAgo,
  showCountdown,
  eagerLoad,
  orientation = "backdrop",
}: {
  item: WatchingMedia;
  onView: () => void;
  onDelete?: (id: string) => Promise<void>;
  showEpisodeBadge?: boolean;
  showRankBadge?: boolean;
  showWatchedAgo?: boolean;
  showCountdown?: boolean;
  eagerLoad?: boolean;
  orientation?: "poster" | "backdrop";
}) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const isPoster = orientation === "poster";
  // Compact on the narrow poster (mobile): "2w" instead of "2 weeks ago", which crowds the tile.
  const ago = showWatchedAgo ? watchedAgo(item.watched_at, { short: isPoster }) : null;
  // "Waiting for" cards: the countdown to release. Legacy rows with no stored date still belong here
  // (via status) but can't count — they say "Soon" rather than nothing.
  const countdown = showCountdown ? (releaseCountdown(item.release_date, { short: isPoster }) ?? "Soon") : null;

  return (
    <div
      className={cn("group relative w-full cursor-pointer transition-transform duration-300 ease-out hover:z-10 hover:scale-[1.04]", isPoster ? "rounded-tile" : "rounded-card")}
      onClick={onView}
    >
      {/* overflow-hidden only on the image container so the dropdown can escape */}
      <div className={cn("relative overflow-hidden bg-zinc-800", isPoster ? "rounded-tile aspect-2/3" : "rounded-card aspect-video")}>
        <Image
          src={isPoster
            ? (item.poster_url || item.backdrop_url || "/placeholder.svg")
            : (item.backdrop_url || item.poster_url || "/placeholder.svg")}
          alt={item.title}
          fill
          className="object-cover transition-opacity duration-500"
          style={{ opacity: imgLoaded ? 1 : 0 }}
          sizes={isPoster ? "45vw" : "(max-width: 768px) 100vw, 50vw"}
          unoptimized
          loading={eagerLoad ? "eager" : "lazy"}
          priority={eagerLoad}
          onLoad={() => setImgLoaded(true)}
        />
        <div className="absolute inset-0 bg-linear-to-t from-black/85 via-black/30 to-transparent" />

        {/* THE OVERLAY GRAMMAR — two clusters, and nothing else may sit on the artwork:
            left = IDENTITY (what this title is: rank, priority), right = ACTIONS (favorite,
            menu). Same inset, same 24px item height, same gap → they align by construction
            instead of by three separate `top-2` / `top-3` guesses. */}
        <div className={cn(OVERLAY_CLUSTER, "left-2.5")}>
          {showRankBadge && item.priority && <RankMark rank={item.priority} />}
          {/* Priority is "how badly do I want to watch this" — meaningless for a film that isn't out
              yet. In the Waiting for rail (showCountdown) the countdown is the only mark that belongs. */}
          {item.want_to_watch && item.priority_level && !showCountdown && (
            <Badge variant="flag" size="sm" uppercase color={PRIORITY_COLOR[item.priority_level]}>
              {item.priority_level}
            </Badge>
          )}
          {/* WHEN you watched it — a factual timestamp, not a verdict, so it's neutral white, not
              the teal of a rating or the gold of the world. It has this cluster to itself: rank and
              priority never apply to a watched title. */}
          {ago && (
            <Badge variant="flag" size="sm" color="rgba(255,255,255,0.92)">
              <Clock size={11} />
              {ago}
            </Badge>
          )}
          {/* Time until release — a world fact about the future, so neutral white like the watched-ago
              stamp, not the teal of something that's yours yet. */}
          {countdown && (
            <Badge variant="flag" size="sm" color="rgba(255,255,255,0.92)">
              <CalendarClock size={11} />
              {countdown}
            </Badge>
          )}
        </div>

        <div className="absolute bottom-0 inset-x-0 p-4">
          <h4 className="text-sm font-semibold text-white line-clamp-1">
            {displayTitle(item)}
          </h4>

          {/* Episode progress — and, beside it, the way to move it. The card has always known
              you were on S03 E03; it just wouldn't let you say you'd watched E04, so the most
              frequent gesture in the app cost four taps and a page load.

              The chip and the button are forced to the SAME 24px height (h-6). The chip was a
              hand-rolled span with its own padding, so it sat a few pixels off the button beside
              it — the same mechanical mismatch that made the List Detail toolbar look "off". A
              row aligns when its items share a height, not when you nudge them. */}
          {showEpisodeBadge &&
            ((item.current_episode ?? 0) > 0 || (item.current_season ?? 1) > 1) && (
              <div className="space-y-1.5">
                {/* flex-wrap: on a narrow mobile poster, the position chip + a wide state chip
                    ("Caught up") overflowed the card edge. They now stack instead of spilling. */}
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className="inline-flex h-6 shrink-0 items-center rounded-chip px-2 text-micro font-semibold leading-none"
                    style={{
                      backgroundColor: "color-mix(in srgb, var(--color-accent-watching) 40%, transparent)",
                      color: "var(--color-accent-watching-vivid)",
                    }}
                  >
                    {formatPosition(item.current_season ?? 1, item.current_episode ?? 0)}
                  </span>
                  <span onClick={(e) => e.stopPropagation()}>
                    <NextEpisodeButton item={item} />
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
            {/* Genres, styled like the detail hero's — a quiet rounded pill, not the `overlay` badge
                (that variant is built to sit ON artwork; here it's on the card body, where its bright
                fill read as louder than the title). Same soft pill both places now. */}
            {!isPoster && item.tags?.slice(0, 2).map((tag) => (
              <span key={tag} className="max-w-24 shrink truncate rounded-full bg-white/6 px-2 py-0.5 text-micro text-white/40 ring-1 ring-white/6">
                {tag}
              </span>
            ))}
            <span className="shrink-0 text-xs text-text-tertiary">{item.year}</span>

            {/* YOUR rating → teal star. It used to be gold, which is the WORLD's colour —
                the same mark meant two different things depending on the screen. */}
            {item.user_rating != null && item.user_rating > 0 && (
              <ScoreMark value={item.user_rating} source="mine" className="shrink-0" />
            )}
          </div>
        </div>
      </div>

      {/* Right cluster = ACTIONS. The favorite mark lives here too — it used to float at
          `right-10 top-3` while the menu sat at `right-2 top-2`, so nothing lined up.
          (MediaActionMenu portals its dropdown, so no overflow clip.) */}
      <div className={cn(OVERLAY_CLUSTER, "right-2.5")} onClick={(e) => e.stopPropagation()}>
        {item.favorite && (
          <span className={OVERLAY_CIRCLE}>
            <LoveMark size={12} />
          </span>
        )}
        <span className="opacity-100 transition-opacity duration-150 ease-out sm:opacity-0 sm:group-hover:opacity-100">
          <MediaActionMenu item={item} onView={onView} onDelete={onDelete} />
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
  onDelete,
  showEpisodeBadge = false,
  showRankBadge = false,
  showWatchedAgo = false,
  showCountdown = false,
}: MediaCarouselProps) {
  const router = useRouter();
  // Add IS shown in the read-only demo — clicking it runs the full add flow, then
  // the guarded mutation shows the friendly read-only toast.
  const canAdd = !!onAddClick;
  const scrollRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [cardsPerView, setCardsPerView] = useState(5);
  const [localItems, setLocalItems] = useState(items);
  const prevFirstIdRef = useRef<string | null>(null);
  const gap = 16;

  useEffect(() => {
    setLocalItems(items);
  }, [items]);

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
  const sortedItems = localItems;

  // Auto-scroll back to the start when a NEW item takes position 1 — covers both
  // adding (Want to Watch) AND a freshly-watched title entering Recently Watched
  // (which is length-capped, so a length check wouldn't fire).
  useEffect(() => {
    const firstId = sortedItems[0]?.id ?? null;
    if (prevFirstIdRef.current !== null && firstId && firstId !== prevFirstIdRef.current) {
      setCurrentIndex(0);
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ left: 0, behavior: "smooth" });
      });
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
    width: `calc((100% - ${(cardsPerView - 1) * gap}px) / ${cardsPerView})`,
  };

  if (localItems.length === 0) {
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
    <section>
      <SectionHeader
        title={title}
        subtitle={subtitle}
        actions={
          <>
            <CarouselNav
              className="hidden lg:flex"
              onPrev={() => scroll("prev")}
              onNext={() => scroll("next")}
              canPrev={canGoPrev}
              canNext={canGoNext}
            />
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
        className="hidden lg:flex gap-4 overflow-x-auto scroll-smooth snap-x snap-mandatory py-1.5 -mx-4 px-4 scroll-px-4 sm:-mx-6 sm:px-6 sm:scroll-px-6"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {sortedItems.map((item, i) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.25,
              delay: i * 0.04,
              ease: [0.23, 1, 0.32, 1],
            }}
            className="shrink-0 snap-start"
            style={itemWidthStyle}
          >
            <MovieCard
              item={item}
              onView={() => router.push(`/perso/watching/${item.id}`)}
              onDelete={onDelete}
              showEpisodeBadge={showEpisodeBadge}
              showRankBadge={showRankBadge}
              showWatchedAgo={showWatchedAgo}
              showCountdown={showCountdown}
              eagerLoad={i < cardsPerView}
            />
          </motion.div>
        ))}
      </div>

      {/* Mobile: swipeable poster rail (~2.4 visible) — posters read better than
          wide backdrops on a phone. Native swipe; no arrows. */}
      <div className="flex lg:hidden gap-3 overflow-x-auto custom-scrollbar-hide snap-x snap-mandatory py-1.5">
        {sortedItems.map((item, i) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: i * 0.04, ease: [0.23, 1, 0.32, 1] }}
            className="w-[42%] shrink-0 snap-start"
          >
            <MovieCard
              orientation="poster"
              item={item}
              onView={() => router.push(`/perso/watching/${item.id}`)}
              onDelete={onDelete}
              showEpisodeBadge={showEpisodeBadge}
              showRankBadge={showRankBadge}
              showWatchedAgo={showWatchedAgo}
              showCountdown={showCountdown}
              eagerLoad={i < 3}
            />
          </motion.div>
        ))}
      </div>
    </section>
  );
}
