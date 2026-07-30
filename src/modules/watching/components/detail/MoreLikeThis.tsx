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

/**
 * The rail's own skeleton, living next to the real thing so the two cannot drift — the same reason
 * CastCrew and Episodes keep theirs here rather than in WatchingSkeletons.
 * Six tiles, the same grid, and the title/year caption underneath: a poster alone is 55px short.
 */
export function MoreLikeThisSkeleton() {
  return (
    <section>
      <SectionHeader title="More Like This" />
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 py-1.5 scrollbar-hide sm:-mx-1.5 sm:px-1.5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="w-(--rail-peek) shrink-0 sm:w-(--poster-lg)">
            <div className="aspect-2/3 w-full animate-pulse rounded-tile bg-surface-2" />
            <p className="mt-2 text-xs">
              <span className="inline-block h-2 w-4/5 animate-pulse rounded-full bg-surface-2 align-middle" />
            </p>
            <p className="text-micro">
              <span className="inline-block h-2 w-8 animate-pulse rounded-full bg-surface-2 align-middle" />
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

interface Props {
  items: SimilarItem[];
  /**
   * True while the recommendations are still in flight. Without it this component could not tell
   * "none" from "not yet" — so on a cold load it returned null, the page skeleton's block vanished,
   * a hole opened, and the rail dropped in afterwards. That is the module's oldest disease
   * (`pending` on the coordinate lens, the discover flash) in one more place.
   */
  loading?: boolean;
  /** Click → add to "Want to Watch". When omitted (e.g. demo), cards are inert. */
  onAddClick?: (item: SimilarItem) => void;
}

export function MoreLikeThis({ items, loading = false, onAddClick }: Props) {
  if (loading) return <MoreLikeThisSkeleton />;
  if (items.length === 0) return null;
  const clickable = !!onAddClick;

  return (
    <section>
      <SectionHeader title="More Like This" />
      {/* One scrolling rail at EVERY size — the same shape as Watch History, so the poster is one
          fixed rung (`--poster-lg` past `sm`, `--rail-peek` on mobile) instead of a grid column that
          resizes with the viewport. That keeps the poster identical on iPad portrait, iPad landscape
          and desktop; you scroll for more rather than cramming a different count into each width.
          py-1.5 leaves room for the hover scale the overflow-x container would otherwise clip. */}
      <div className="-mx-4 flex snap-x gap-3 overflow-x-auto scroll-px-4 px-4 py-1.5 scrollbar-hide sm:-mx-1.5 sm:px-1.5 sm:scroll-px-1.5">
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
              className="group block w-(--rail-peek) shrink-0 snap-start cursor-pointer text-left disabled:cursor-default sm:w-(--poster-lg)"
            >
              <div className="relative aspect-2/3 overflow-hidden rounded-tile border border-border-subtle transition-transform duration-300 ease-out group-hover:z-10 group-hover:scale-[1.04]">
                <Image
                  src={sim.poster_path ? `https://image.tmdb.org/t/p/w500${sim.poster_path}` : "/placeholder.svg"}
                  alt={title}
                  fill
                  sizes="(max-width: 640px) 40vw, 200px"
                  loading="lazy"
                  className="object-cover"
                />
                {clickable && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all duration-300 group-hover:bg-black/25 group-hover:opacity-100">
                    <div className="on-artwork flex h-7 w-7 items-center justify-center rounded-full">
                      <Plus size={13} className="text-white" />
                    </div>
                  </div>
                )}
              </div>
              <p className="mt-2 truncate text-xs text-text-secondary transition-colors group-hover:text-text-primary">
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
