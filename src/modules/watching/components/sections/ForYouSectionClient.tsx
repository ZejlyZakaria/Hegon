"use client";

import { useRef, useEffect, useState } from "react";
import Image from "next/image";
import { Star, ChevronLeft, ChevronRight } from "lucide-react";
import { useForYouRecommendations } from "@/modules/watching/hooks/useForYouRecommendations";
import { useWatching } from "@/modules/watching/components/WatchingClient";
import { cn } from "@/shared/utils/utils";
import type { WatchingConfig } from "@/modules/watching/types";
import type { ForYouItem } from "@/modules/watching/service";

const TMDB_W500 = "https://image.tmdb.org/t/p/w500";

// ─── skeleton ─────────────────────────────────────────────────────────────────

function ForYouSkeleton() {
  return (
    <section className="mb-3">
      <div className="mb-3 flex items-center justify-between">
        <div className="h-5 w-24 rounded bg-surface-2 animate-pulse" />
      </div>
      <div className="flex gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex-1 aspect-video rounded-xl bg-surface-1 animate-pulse" />
        ))}
      </div>
    </section>
  );
}

// ─── card ─────────────────────────────────────────────────────────────────────

function ForYouCard({
  item,
  onClick,
  eagerLoad,
}: {
  item: ForYouItem;
  onClick: () => void;
  eagerLoad?: boolean;
}) {
  const imgSrc = item.backdrop_path
    ? `${TMDB_W500}${item.backdrop_path}`
    : item.poster_path
      ? `${TMDB_W500}${item.poster_path}`
      : null;
  const rating = item.vote_average > 0 ? item.vote_average.toFixed(1) : null;

  return (
    <div
      className="group relative w-full overflow-hidden rounded-xl border border-white/10 cursor-pointer"
      onClick={onClick}
    >
      <div className="relative aspect-video">
        {imgSrc ? (
          <Image
            src={imgSrc}
            alt={item.title}
            fill
            unoptimized
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, (max-width: 1280px) 33vw, 20vw"
            loading={eagerLoad ? "eager" : "lazy"}
            priority={eagerLoad}
          />
        ) : (
          <div className="absolute inset-0 bg-zinc-800" />
        )}
        <div className="absolute inset-0 bg-linear-to-t from-black via-black/50 to-transparent" />

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
  const { data: items = [], isLoading } = useForYouRecommendations(userId, config.type);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [cardsPerView, setCardsPerView] = useState(5);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { openModalWithItem } = useWatching();
  const gap = 16;

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
    <section className="mb-3">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-text-primary tracking-tight">
            For You
          </h3>
          <p className="mt-1 text-sm text-text-tertiary">Based on what you love</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => canGoPrev && scroll("prev")}
            className={cn(
              "rounded-full border border-white/10 p-2 transition-all duration-300",
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
              "rounded-full border border-white/10 p-2 transition-all duration-300",
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
        className="flex gap-4 overflow-x-auto scroll-smooth snap-x snap-mandatory"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {items.map((item, i) => (
          <div
            key={item.id}
            className="shrink-0 snap-start transition-all duration-500 ease-in-out"
            style={itemWidthStyle}
          >
            <ForYouCard
              item={item}
              onClick={() => handleAdd(item)}
              eagerLoad={i < cardsPerView}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
