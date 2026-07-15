"use client";

import Image from "next/image";
import { Plus } from "lucide-react";
import { SectionHeader } from "@/shared/components/ui/section-header";

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
      <SectionHeader title="More Like This" />
      {/* Mobile: one scrolling row — a 3-wide grid of tiny posters wrapped onto two lines and
          ate the screen. Desktop keeps the grid. py-1 leaves room for the hover scale, which
          an overflow-x container would otherwise clip. */}
      <div className="-mx-4 flex snap-x gap-3 overflow-x-auto scroll-px-4 px-4 py-1 scrollbar-hide sm:mx-0 sm:grid sm:grid-cols-4 sm:overflow-visible sm:px-0 lg:grid-cols-6">
        {items.slice(0, 6).map((sim) => {
          const title = sim.title || sim.name || "";
          // The year earns its place here: in a franchise it's the fastest way to read the order —
          // "which one comes next" is answered by a date, not a plot summary.
          const date = sim.release_date || sim.first_air_date;
          const year = date ? new Date(date).getFullYear() : null;
          return (
            <button
              key={sim.id}
              type="button"
              disabled={!clickable}
              onClick={() => onAddClick?.(sim)}
              className="group block w-(--rail-peek) shrink-0 snap-start cursor-pointer text-left disabled:cursor-default sm:w-auto"
            >
              <div className="relative aspect-2/3 overflow-hidden rounded-tile border border-border-subtle transition-transform duration-300 ease-out group-hover:z-10 group-hover:scale-[1.04]">
                <Image
                  src={sim.poster_path ? `https://image.tmdb.org/t/p/w300${sim.poster_path}` : "/placeholder.svg"}
                  alt={title}
                  fill
                  sizes="15vw"
                  loading="lazy"
                  className="object-cover"
                  unoptimized
                />
                {clickable && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all duration-300 group-hover:bg-black/25 group-hover:opacity-100">
                    <div className="on-artwork flex h-7 w-7 items-center justify-center rounded-full">
                      <Plus size={13} className="text-white" />
                    </div>
                  </div>
                )}
              </div>
              <p className="mt-2 line-clamp-2 min-h-9 text-xs leading-snug text-text-secondary transition-colors group-hover:text-text-primary">
                {title}
              </p>
              {year && <p className="text-micro tabular-nums text-text-tertiary">{year}</p>}
            </button>
          );
        })}
      </div>
    </section>
  );
}
