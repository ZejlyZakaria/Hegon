"use client";

import { useRef, useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { motion } from "framer-motion";
import { Star, Heart, Plus, Bookmark } from "lucide-react";
import type { WatchingMedia } from "@/modules/watching/types";
import { cn } from "@/shared/utils/utils";
import { Button } from "@/shared/components/ui/button";
import { CarouselNav } from "@/shared/components/ui/carousel-nav";
import { SectionHeader } from "@/shared/components/ui/section-header";
import { WATCHING_ACCENT } from "@/modules/watching/ui";
import { displayTitle } from "@/modules/watching/utils";
import { MediaActionMenu } from "./MediaActionMenu";

// ─── helpers ─────────────────────────────────────────────────────────────────

function computeProgress(item: WatchingMedia): number {
  if (!item.season_episodes?.length) return 0;
  const seasonIdx = (item.current_season ?? 1) - 1;
  const prevEps = item.season_episodes
    .slice(0, seasonIdx)
    .reduce((s, n) => s + n, 0);
  const total = item.season_episodes.reduce((s, n) => s + n, 0);
  return total
    ? Math.round(((prevEps + (item.current_episode ?? 0)) / total) * 100)
    : 0;
}

// ─── types ────────────────────────────────────────────────────────────────────

type MediaCarouselProps = {
  title: string;
  subtitle?: string;
  items: WatchingMedia[];
  onAddClick?: () => void;
  onDelete?: (itemId: string) => Promise<void>;
  showEpisodeBadge?: boolean;
  showRankBadge?: boolean;
};


// ─── movie card ───────────────────────────────────────────────────────────────

function MovieCard({
  item,
  onView,
  onDelete,
  showEpisodeBadge,
  showRankBadge,
  eagerLoad,
  orientation = "backdrop",
}: {
  item: WatchingMedia;
  onView: () => void;
  onDelete?: (id: string) => Promise<void>;
  showEpisodeBadge?: boolean;
  showRankBadge?: boolean;
  eagerLoad?: boolean;
  orientation?: "poster" | "backdrop";
}) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const isPoster = orientation === "poster";

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

        {/* rank badge */}
        {showRankBadge && item.priority && (
          <div className="absolute top-3 left-3 flex h-8 w-8 items-center justify-center rounded-full bg-black border-2 border-white text-xs font-bold text-white z-10">
            {item.priority}
          </div>
        )}

        {/* priority icon */}
        {item.want_to_watch && item.priority_level && (
          <div className="absolute top-0 left-0 z-10">
            <Bookmark
              size={24}
              className={cn(
                "fill-current",
                item.priority_level === "high"   ? "text-red-500"    :
                item.priority_level === "medium" ? "text-amber-400"  :
                                                   "text-zinc-300",
              )}
              style={{ filter: "drop-shadow(0 1px 4px rgba(0,0,0,0.9))" }}
            />
          </div>
        )}

        {item.favorite && (
          <div className="absolute top-3 right-10">
            <Heart size={16} className="fill-red-500 text-red-500" />
          </div>
        )}

        <div className="absolute bottom-0 inset-x-0 p-4">
          <h4 className="text-sm font-semibold text-white line-clamp-1">
            {displayTitle(item)}
          </h4>

          {/* episode progress — show once started: current episode, OR past season 1
              (a season bump resets the episode to 0 but prior seasons are done). */}
          {showEpisodeBadge &&
            ((item.current_episode ?? 0) > 0 || (item.current_season ?? 1) > 1) && (
              <div className="space-y-1.5">
                <span
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                  style={{
                    backgroundColor: "color-mix(in srgb, var(--color-accent-watching) 40%, transparent)",
                    color: "var(--color-accent-watching-vivid)",
                  }}
                >
                  {"S" +
                    String(item.current_season ?? 1).padStart(2, "0") +
                    " E" +
                    String(item.current_episode).padStart(2, "0")}
                </span>
                {computeProgress(item) > 0 && (
                  <div className="h-0.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${computeProgress(item)}%`,
                        backgroundColor: "var(--color-accent-watching-vivid)",
                      }}
                    />
                  </div>
                )}
              </div>
            )}

          <div className="mt-1.5 flex items-center gap-2 min-w-0">
            {!isPoster && item.tags?.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white max-w-20 truncate"
              >
                {tag}
              </span>
            ))}
            <span className="text-xs text-text-tertiary shrink-0">
              {item.year}
            </span>

            {item.user_rating != null && item.user_rating > 0 && (
              <div className="flex items-center gap-1 text-xs text-white shrink-0">
                <Star size={12} className="fill-amber-400 text-amber-400" />
                {item.user_rating}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MediaActionMenu renders its dropdown via Portal — no overflow clip */}
      <div
        className="absolute top-2 right-2 z-10 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-150 ease-out"
        onClick={(e) => e.stopPropagation()}
      >
        <MediaActionMenu
          item={item}
          onView={onView}
          onDelete={onDelete}
        />
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

  const sortedItems = useMemo(
    () =>
      [...localItems].sort((a, b) => (a.priority || 999) - (b.priority || 999)),
    [localItems],
  );

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
              eagerLoad={i < 3}
            />
          </motion.div>
        ))}
      </div>
    </section>
  );
}
