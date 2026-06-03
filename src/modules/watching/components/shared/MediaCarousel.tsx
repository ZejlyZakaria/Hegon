"use client";

import { useRef, useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  Star,
  Heart,
  ChevronLeft,
  ChevronRight,
  Plus,
  Bookmark,
} from "lucide-react";
import type { WatchingMedia } from "@/modules/watching/types";
import { cn } from "@/shared/utils/utils";
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
}: {
  item: WatchingMedia;
  onView: () => void;
  onDelete?: (id: string) => Promise<void>;
  showEpisodeBadge?: boolean;
  showRankBadge?: boolean;
  eagerLoad?: boolean;
}) {
  const [imgLoaded, setImgLoaded] = useState(false);

  return (
    <div
      className="group relative w-full rounded-xl border border-white/10 cursor-pointer"
      onClick={onView}
    >
      {/* overflow-hidden only on the image container so the dropdown can escape */}
      <div className="relative aspect-video overflow-hidden rounded-xl bg-zinc-800">
        <Image
          src={item.backdrop_url || item.poster_url || "/placeholder.svg"}
          alt={item.title}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          style={{ opacity: imgLoaded ? 1 : 0 }}
          sizes="(max-width: 768px) 100vw, 50vw"
          unoptimized
          loading="eager"
          priority={eagerLoad}
          onLoad={() => setImgLoaded(true)}
        />
        <div className="absolute inset-0 bg-linear-to-t from-black via-black/50 to-transparent" />

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

          {/* episode progress */}
          {showEpisodeBadge &&
            item.current_episode != null &&
            item.current_episode > 0 && (
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
            {item.tags?.slice(0, 2).map((tag) => (
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [cardsPerView, setCardsPerView] = useState(5);
  const [localItems, setLocalItems] = useState(items);
  const prevLengthRef = useRef(items.length);
  const gap = 16;

  useEffect(() => {
    setLocalItems(items);
  }, [items]);

  useEffect(() => {
    if (localItems.length > prevLengthRef.current) {
      setCurrentIndex(0);
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ left: 0, behavior: "smooth" });
      });
    }
    prevLengthRef.current = localItems.length;
  }, [localItems.length]);

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
        <div className="mb-3 flex items-center justify-between">
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
          className="rounded-xl border border-border-subtle bg-surface-1 flex flex-col items-center justify-center gap-3 py-12 cursor-pointer group hover:border-border-default transition-colors"
          onClick={onAddClick}
        >
          {onAddClick ? (
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
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-text-primary tracking-tight">
            {title}
          </h3>
          {subtitle && (
            <p className="mt-1 text-sm text-text-tertiary">{subtitle}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => canGoPrev && scroll("prev")}
            className={cn(
              "rounded-full border border-white/10 p-2 transition-[background-color,opacity,transform] duration-150 ease-out active:scale-[0.97]",
              canGoPrev
                ? "text-text-tertiary hover:bg-white/10 hover:text-text-primary cursor-pointer"
                : "text-text-tertiary/20 border-white/5 cursor-not-allowed opacity-50",
            )}
            aria-label="Previous"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={() => canGoNext && scroll("next")}
            className={cn(
              "rounded-full border border-white/10 p-2 transition-[background-color,border-color,opacity] duration-300",
              canGoNext
                ? "text-text-tertiary hover:bg-white/10 hover:text-text-primary cursor-pointer"
                : "text-text-tertiary/20 border-white/5 cursor-not-allowed opacity-50",
            )}
            aria-label="Next"
          >
            <ChevronRight size={16} />
          </button>
          {onAddClick && (
            <button
              type="button"
              onClick={onAddClick}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-[opacity,transform] duration-150 ease-out hover:opacity-90 active:scale-[0.97]"
              style={{ backgroundColor: "var(--color-accent-watching)" }}
            >
              <Plus size={12} />
              Add
            </button>
          )}
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto scroll-smooth snap-x snap-mandatory"
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
    </section>
  );
}
