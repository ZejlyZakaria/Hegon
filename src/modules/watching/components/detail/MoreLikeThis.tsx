"use client";

import Image from "next/image";
import { Plus } from "lucide-react";

interface SimilarItem {
  id: number;
  title?: string;
  name?: string;
  poster_path: string | null;
  backdrop_path?: string | null;
  vote_average?: number;
  overview?: string;
  genre_ids?: number[];
  release_date?: string;
  first_air_date?: string;
}

interface Props {
  items: SimilarItem[];
  /** Click → add to "Want to Watch". When omitted (e.g. demo), cards are inert. */
  onAddClick?: (item: SimilarItem) => void;
}

export function MoreLikeThis({ items, onAddClick }: Props) {
  if (items.length === 0) return null;
  const clickable = !!onAddClick;

  return (
    <section>
      <h2 className="mb-3 text-base font-semibold text-text-primary">More Like This</h2>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {items.slice(0, 6).map((sim) => {
          const title = sim.title || sim.name || "";
          return (
            <button
              key={sim.id}
              type="button"
              disabled={!clickable}
              onClick={() => onAddClick?.(sim)}
              className="group block w-full cursor-pointer text-left disabled:cursor-default"
            >
              <div className="relative aspect-2/3 overflow-hidden rounded-lg border border-border-subtle">
                <Image
                  src={sim.poster_path ? `https://image.tmdb.org/t/p/w300${sim.poster_path}` : "/placeholder.svg"}
                  alt={title}
                  fill
                  sizes="15vw"
                  loading="lazy"
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                  unoptimized
                />
                <div className="absolute inset-0 bg-linear-to-t from-black/70 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                {clickable && (
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-watching text-white shadow-lg">
                      <Plus size={18} />
                    </div>
                  </div>
                )}
              </div>
              <p className="mt-2 line-clamp-2 min-h-9 text-xs leading-snug text-text-secondary transition-colors group-hover:text-text-primary">
                {title}
              </p>
            </button>
          );
        })}
      </div>
    </section>
  );
}
