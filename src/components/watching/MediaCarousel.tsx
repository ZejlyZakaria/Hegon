"use client";

import { useRef, useState, useMemo, useEffect } from "react";
import Image from "next/image";
import { Star, Heart, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import type { WatchItem } from "@/lib/watching-data";
import { cn } from "@/lib/utils";

type MediaCarouselProps = {
  title: string;
  subtitle?: string;
  items: WatchItem[];
  onAddClick?: () => void;
  addCardPosition?: "start" | "end";
};

function MovieCard({ item }: { item: WatchItem }) {
  return (
    <div className="group relative w-full overflow-hidden rounded-xl border border-white/10">
      <div className="relative aspect-video">
        <Image
          src={item.backdrop_url || item.poster_url || "/placeholder.svg"}
          alt={item.title}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-linear-to-t from-black via-black/50 to-transparent" />
        
        {/* Rank badge: Black circle, white border, white text */}
        {item.priority && (
          <div className="absolute top-3 left-3 flex h-8 w-8 items-center justify-center rounded-full bg-black border-2 border-white text-xs font-bold text-white shadow-lg z-10">
            {item.priority}
          </div>
        )}

        {item.favorite && (
          <div className="absolute top-3 right-3">
            <Heart size={16} className="fill-red-500 text-red-500" />
          </div>
        )}
        
        <div className="absolute bottom-0 inset-x-0 p-4">
          <h4 className="text-base font-semibold text-white line-clamp-1">{item.title}</h4>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            {item.tags?.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white"
              >
                {tag}
              </span>
            ))}
            <span className="text-xs text-zinc-400">{item.year}</span>
            {item.user_rating && (
              <div className="flex items-center gap-1 text-xs text-white backdrop-blur">
                <Star size={12} className="fill-amber-400 text-amber-400" />
                {item.user_rating}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function AddCard({ onClick }: { onClick: () => void }) {
  return (
    <div onClick={onClick} className="shrink-0 w-full cursor-pointer">
      <div className="group relative w-full overflow-hidden rounded-xl border border-white/20 bg-linear-to-br from-zinc-900 to-black hover:border-white/40 transition-all duration-300 flex items-center justify-center aspect-video">
        <div className="flex flex-col items-center justify-center gap-4 text-white/70 group-hover:text-white transition-colors">
          <div className="flex h-18 w-18 items-center justify-center rounded-full bg-white/10 backdrop-blur-md group-hover:bg-white/20 transition-all duration-300 shadow-lg">
            <Plus size={35} className="text-white/90 group-hover:text-white" />
          </div>
          <span className="text-sm font-medium">Ajouter un film</span>
        </div>
        <div className="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </div>
  );
}

export function MediaCarousel({
  title,
  subtitle,
  items,
  onAddClick,
  addCardPosition = "end", 
}: MediaCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [cardsPerView, setCardsPerView] = useState(4);
  const gap = 16;

  // Détection dynamique du nombre de cartes par vue basé sur les breakpoints Tailwind
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      if (width < 768) setCardsPerView(1);      // sm
      else if (width < 1024) setCardsPerView(2); // md
      else if (width < 1280) setCardsPerView(3); // lg
      else setCardsPerView(4);                   // xl+
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Tri par priorité (classement)
  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => (a.priority || 999) - (b.priority || 999));
  }, [items]);

  // Calculer le nombre total d'éléments (items + carte d'ajout)
  const totalElements = onAddClick ? sortedItems.length + 1 : sortedItems.length;
  
  const canGoPrev = currentIndex > 0;
  const canGoNext = currentIndex < totalElements - cardsPerView;

  const scroll = (direction: "prev" | "next") => {
    if (!scrollRef.current) return;

    const containerWidth = scrollRef.current.clientWidth;
    // Calcul de la largeur d'une carte en fonction du nombre de cartes visibles
    const cardWidth = (containerWidth - (cardsPerView - 1) * gap) / cardsPerView;

    let newIndex = currentIndex;
    if (direction === "prev" && canGoPrev) newIndex--;
    else if (direction === "next" && canGoNext) newIndex++;

    scrollRef.current.scrollTo({
      left: newIndex * (cardWidth + gap),
      behavior: "smooth",
    });

    setCurrentIndex(Math.min(newIndex, Math.max(0, totalElements - cardsPerView)));
  };

  const itemWidthStyle = {
    width: `calc((100% - ${(cardsPerView - 1) * gap}px) / ${cardsPerView})`,
  };

  const AddCardWrapper = onAddClick ? (
    <div className="shrink-0" style={itemWidthStyle}>
      <AddCard onClick={onAddClick} />
    </div>
  ) : null;

  return (
    <section className="mb-6">
      {/* Header avec boutons alignés au titre */}
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-white">{title}</h3>
          {subtitle && <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>}
        </div>

        <div className="flex gap-2">
          {/* Bouton Prev : Toujours affiché, mais désactivé visuellement si au début */}
          <button
            onClick={() => canGoPrev && scroll("prev")}
            className={cn(
              "rounded-full border border-white/10 p-2 transition-all duration-300",
              canGoPrev
                ? "text-zinc-400 hover:bg-white/10 hover:text-white cursor-pointer"
                : "text-zinc-400/20 border-white/5 cursor-not-allowed opacity-50"
            )}
            aria-label="Précédent"
          >
            <ChevronLeft size={16} />
          </button>

          {/* Bouton Next : Toujours affiché, mais désactivé visuellement si à la fin */}
          <button
            onClick={() => canGoNext && scroll("next")}
            className={cn(
              "rounded-full border border-white/10 p-2 transition-all duration-300",
              canGoNext
                ? "text-zinc-400 hover:bg-white/10 hover:text-white cursor-pointer"
                : "text-zinc-400/20 border-white/5 cursor-not-allowed opacity-50"
            )}
            aria-label="Suivant"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Carousel sans scrollbar visible */}
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-hidden scroll-smooth"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {onAddClick && addCardPosition === "start" && AddCardWrapper}

        {sortedItems.map((item) => (
          <div
            key={item.id}
            className="shrink-0 transition-all duration-500 ease-in-out"
            style={itemWidthStyle}
          >
            <MovieCard item={item} />
          </div>
        ))}

        {onAddClick && addCardPosition === "end" && AddCardWrapper}
      </div>
    </section>
  );
}
