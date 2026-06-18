"use client";

import { useRef, useEffect, useLayoutEffect, useState, useCallback } from "react";
import Image from "next/image";
import { Star, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useForYouRecommendations } from "@/modules/watching/hooks/useForYouRecommendations";
import { useOwnedTmdbIds } from "@/modules/watching/hooks/useOwnedTmdbIds";
import { useWatching } from "@/modules/watching/components/WatchingClient";
import { ForYouSkeleton } from "@/modules/watching/components/shared/WatchingSkeletons";
import { cn } from "@/shared/utils/utils";
import type { WatchingConfig } from "@/modules/watching/types";
import type { ForYouItem } from "@/modules/watching/service";

const TMDB_W500 = "https://image.tmdb.org/t/p/w500";

function getDismissedKey(type: string) {
  return `hegon_dismissed_foryou_${type}`;
}

function getDismissed(type: string): Set<number> {
  try {
    const raw = localStorage.getItem(getDismissedKey(type));
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function addDismissed(type: string, id: number) {
  try {
    const set = getDismissed(type);
    set.add(id);
    localStorage.setItem(getDismissedKey(type), JSON.stringify([...set]));
  } catch { /* ignore */ }
}

// ─── card ─────────────────────────────────────────────────────────────────────

function ForYouCard({
  item,
  onClick,
  onDismiss,
  priority,
  orientation = "backdrop",
}: {
  item: ForYouItem;
  onClick: () => void;
  onDismiss: () => void;
  priority?: boolean;
  orientation?: "poster" | "backdrop";
}) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const isPoster = orientation === "poster";
  const imgSrc = isPoster
    ? (item.poster_path ? `${TMDB_W500}${item.poster_path}` : item.backdrop_path ? `${TMDB_W500}${item.backdrop_path}` : null)
    : (item.backdrop_path ? `${TMDB_W500}${item.backdrop_path}` : item.poster_path ? `${TMDB_W500}${item.poster_path}` : null);
  const rating = item.vote_average > 0 ? item.vote_average.toFixed(1) : null;

  return (
    <div
      className={cn("group relative w-full cursor-pointer overflow-hidden transition-transform duration-300 ease-out hover:z-10 hover:scale-[1.04]", isPoster ? "rounded-tile" : "rounded-card")}
      onClick={onClick}
    >
      <div className={cn("relative bg-surface-2", !imgLoaded && "animate-pulse", isPoster ? "aspect-2/3" : "aspect-video")}>
        {imgSrc && (
          <Image
            src={imgSrc}
            alt={item.title}
            fill
            unoptimized
            className="object-cover transition-opacity duration-500"
            style={{ opacity: imgLoaded ? 1 : 0 }}
            sizes={isPoster ? "45vw" : "(max-width: 768px) 100vw, (max-width: 1280px) 33vw, 20vw"}
            loading="eager"
            priority={priority}
            onLoad={() => setImgLoaded(true)}
          />
        )}
        <div className="absolute inset-0 bg-linear-to-t from-black/85 via-black/30 to-transparent" />

        {/* "New" badge — surfaced in the latest 5-day rotation */}
        {item.is_new && (
          <div className="absolute top-2 left-2 z-10 rounded-full bg-[#2dd4bf] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-zinc-950 shadow-sm">
            New
          </div>
        )}

        {/* Dismiss button */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDismiss(); }}
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 border border-white/10 text-white/60 hover:text-white hover:bg-black/80"
          title="Pas intéressé"
        >
          <X size={12} />
        </button>

        <div className="absolute bottom-0 inset-x-0 p-4">
          <h4 className="text-sm font-semibold text-white line-clamp-1">{item.title}</h4>
          <div className="mt-1.5 flex items-center gap-2">
            {rating && (
              <div className="flex items-center gap-1">
                <Star size={11} className="fill-amber-400 text-amber-400" />
                <span className="text-xs text-amber-400">{rating}</span>
              </div>
            )}
            {item.year && <span className="text-xs text-white/40">{item.year}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── section ──────────────────────────────────────────────────────────────────

export default function ForYouSectionClient({
  userId,
  config,
}: {
  userId: string;
  config: WatchingConfig;
}) {
  const { data: rawItems = [], isLoading } = useForYouRecommendations(userId, config.type);
  const { data: ownedIds = [] } = useOwnedTmdbIds(userId, config.type);
  const [dismissed, setDismissed] = useState<Set<number>>(() => getDismissed(config.type));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [cardsPerView, setCardsPerView] = useState(5);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { openModalWithItem } = useWatching();
  const gap = 16;

  // Live filter against the library (handles titles added since the last 5-day
  // refresh) + dismissed, then take 10 — the stored ~20 is the reserve, so adding
  // or dismissing one slides the next in without refetching.
  const owned = new Set(ownedIds);
  const items = rawItems.filter((i) => !dismissed.has(i.id) && !owned.has(i.id)).slice(0, 10);

  // Reset scroll when items change (data reload or dismissal)
  useLayoutEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrentIndex(0);
    if (scrollRef.current) scrollRef.current.scrollTo({ left: 0 });
  }, [items.length]);

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

  const handleDismiss = useCallback((id: number) => {
    addDismissed(config.type, id);
    setDismissed((prev) => new Set([...prev, id]));
  }, [config.type]);

  if (isLoading) return <ForYouSkeleton />;
  if (items.length === 0) return null;

  const totalElements = items.length;
  const canGoPrev = currentIndex > 0;
  const canGoNext = currentIndex < totalElements - cardsPerView;

  const scroll = (direction: "prev" | "next") => {
    if (!scrollRef.current) return;
    const containerWidth = scrollRef.current.clientWidth;
    const cardWidth = (containerWidth - (cardsPerView - 1) * gap) / cardsPerView;
    let newIndex = currentIndex;
    if (direction === "prev" && canGoPrev) newIndex--;
    else if (direction === "next" && canGoNext) newIndex++;
    scrollRef.current.scrollTo({ left: newIndex * (cardWidth + gap), behavior: "smooth" });
    setCurrentIndex(Math.min(newIndex, Math.max(0, totalElements - cardsPerView)));
  };

  const handleAdd = (item: ForYouItem) => {
    const tmdbMediaType = config.type === "film" ? "movie" : "tv";
    openModalWithItem("wantToWatch", {
      id: item.id,
      title: item.title,
      name: item.title,
      poster_path: item.poster_path,
      backdrop_path: item.backdrop_path,
      vote_average: item.vote_average,
      overview: item.overview,
      genre_ids: item.genre_ids,
      media_type: tmdbMediaType,
      ...(config.type === "film"
        ? { release_date: item.year ? `${item.year}-01-01` : undefined }
        : { first_air_date: item.year ? `${item.year}-01-01` : undefined }),
    });
  };

  const itemWidthStyle = {
    width: `calc((100% - ${(cardsPerView - 1) * gap}px) / ${cardsPerView})`,
  };

  return (
    <section>
      <div className="mb-1.5 flex items-center justify-between">
        <div>
          <h3 className="text-title text-text-primary">
            For You
          </h3>
          <p className="mt-1 text-xs text-text-tertiary">Based on what you love</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => canGoPrev && scroll("prev")}
            className={cn(
              "hidden lg:block rounded-full border border-white/10 p-2 transition-[background-color,opacity,transform] duration-150 ease-out active:scale-[0.97]",
              canGoPrev
                ? "text-text-tertiary hover:bg-white/10 hover:text-text-primary cursor-pointer"
                : "text-text-tertiary/20 border-white/5 cursor-not-allowed opacity-50",
            )}
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={() => canGoNext && scroll("next")}
            className={cn(
              "hidden lg:block rounded-full border border-white/10 p-2 transition-[background-color,opacity,transform] duration-150 ease-out active:scale-[0.97]",
              canGoNext
                ? "text-text-tertiary hover:bg-white/10 hover:text-text-primary cursor-pointer"
                : "text-text-tertiary/20 border-white/5 cursor-not-allowed opacity-50",
            )}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="hidden lg:flex gap-4 overflow-x-auto scroll-smooth snap-x snap-mandatory py-1.5 -mx-4 px-4 scroll-px-4 sm:-mx-6 sm:px-6 sm:scroll-px-6"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {items.map((item, i) => (
          <div
            key={item.id}
            className="shrink-0 snap-start"
            style={itemWidthStyle}
          >
            <ForYouCard
              item={item}
              onClick={() => handleAdd(item)}
              onDismiss={() => handleDismiss(item.id)}
              priority={i < 3}
            />
          </div>
        ))}
      </div>

      {/* Mobile: swipeable poster rail (~2.4 visible) */}
      <div className="flex lg:hidden gap-3 overflow-x-auto custom-scrollbar-hide snap-x snap-mandatory">
        {items.map((item, i) => (
          <div key={item.id} className="w-[42%] shrink-0 snap-start">
            <ForYouCard
              orientation="poster"
              item={item}
              onClick={() => handleAdd(item)}
              onDismiss={() => handleDismiss(item.id)}
              priority={i < 3}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
