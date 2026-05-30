/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Star, TrendingUp } from "lucide-react";
import { mapTmdbGenres } from "@/modules/watching/lib/media-utils";
import { useWatchingHero } from "@/modules/watching/hooks/useWatchingHero";
import { useWatching } from "@/modules/watching/components/WatchingClient";
import type { WatchingConfig } from "@/modules/watching/types";

const TMDB_W500 = "https://image.tmdb.org/t/p/w500";
const CARD_BG   = "#0e0e10";
const EXP       = 22;   // 22/(22+7×4) = 44%
const COL       = 7;    // 7/50         = 14%
// card row height = h-60 = 240px → portrait poster width = 240 × 2/3 = 160px
const POSTER_W  = 160;

// ─── skeleton ─────────────────────────────────────────────────────────────────

export function DontMissSkeleton() {
  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-3.5 h-3.5 rounded-full bg-surface-2 animate-pulse" />
        <div className="w-20 h-3 rounded bg-surface-2 animate-pulse" />
      </div>
      <div className="flex gap-3 h-60">
        {[EXP, COL, COL, COL, COL, COL].map((f, i) => (
          <div key={i} className="rounded-2xl bg-surface-1 animate-pulse" style={{ flex: f }} />
        ))}
      </div>
    </section>
  );
}

// ─── card ─────────────────────────────────────────────────────────────────────

function DontMissCard({
  item,
  isActive,
  isTrending,
  isFirst,
  onHover,
  onAdd,
}: {
  item: any;
  isActive: boolean;
  isTrending: boolean;
  isFirst: boolean;
  onHover: () => void;
  onAdd: () => void;
}) {
  const [posterLoaded, setPosterLoaded] = useState(false);
  const posterUrl = item.poster_path ? `${TMDB_W500}${item.poster_path}` : null;
  const title  = item.title || item.name;
  const year   = (item.release_date || item.first_air_date)?.slice(0, 4);
  const rating = item.vote_average?.toFixed(1);
  const genres = mapTmdbGenres(item.genre_ids ?? []).slice(0, 3);

  return (
    <div
      className="relative rounded-2xl overflow-hidden cursor-pointer min-w-0"
      style={{
        flex: isActive ? EXP : COL,
        transition: "flex 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
        backgroundColor: CARD_BG,
      }}
      onMouseEnter={onHover}
    >
      {/* ── portrait poster — left-anchored, natural 2:3 dimensions ── */}
      <div
        className="absolute left-0 top-0 bottom-0 bg-zinc-800"
        style={{ aspectRatio: "2/3" }}
      >
        {posterUrl && (
          <Image
            src={posterUrl}
            alt={title}
            fill
            unoptimized
            className="object-cover transition-opacity duration-500"
            style={{ opacity: posterLoaded ? 1 : 0 }}
            sizes="25vw"
            loading="eager"
            priority={isFirst}
            onLoad={() => setPosterLoaded(true)}
          />
        )}
      </div>

      {/* ── expanded state ── */}
      <AnimatePresence>
        {isActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, delay: 0.22 }}
            className="absolute inset-0"
          >
            {/* fade poster right edge into dark background */}
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(to right, transparent ${POSTER_W - 32}px, ${CARD_BG} ${POSTER_W + 20}px)`,
              }}
            />

            {/* info panel — starts right after the poster */}
            <div
              className="absolute right-0 top-0 bottom-0 flex flex-col justify-end pb-5 pr-6 pl-5 min-w-0"
              style={{ left: `${POSTER_W}px` }}
            >
              {isTrending && (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold text-white bg-accent-watching backdrop-blur-sm self-start mb-3">
                  <TrendingUp size={10} />
                  Trending
                </div>
              )}

              {genres.length > 0 && (
                <div className="flex gap-1.5 flex-wrap mb-2">
                  {genres.map((g) => (
                    <span key={g} className="text-[10px] px-2 py-0.5 bg-white/10 rounded-full text-white/65">
                      {g}
                    </span>
                  ))}
                </div>
              )}

              <h3 className="text-base font-bold text-white leading-snug line-clamp-2 mb-1.5">
                {title}
              </h3>

              <div className="flex items-center gap-2.5 mb-2">
                {rating && (
                  <div className="flex items-center gap-1">
                    <Star size={11} className="fill-amber-400 text-amber-400" />
                    <span className="text-xs font-semibold text-amber-400">{rating}</span>
                  </div>
                )}
                {year && <span className="text-xs text-white/40">{year}</span>}
              </div>

              {item.overview && (
                <p className="text-[11px] text-white/60 line-clamp-3 leading-relaxed mb-3">
                  {item.overview}
                </p>
              )}

              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onAdd(); }}
                className="self-start flex items-center gap-1.5 rounded-lg bg-accent-watching px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90"
              >
                <Plus size={12} />
                Add to collection
              </button>

            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── collapsed state — bottom gradient + title + rating ── */}
      <AnimatePresence>
        {!isActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 flex flex-col justify-end"
          >
            <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent" />
            <div className="relative px-3 pb-3 flex flex-col gap-1">
              <p className="text-[11px] font-semibold text-white truncate">{title}</p>
              {rating && (
                <div className="flex items-center gap-1">
                  <Star size={9} className="fill-amber-400 text-amber-400" />
                  <span className="text-[10px] font-medium text-amber-400">{rating}</span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── trending badge — collapsed poster only ── */}
      {isTrending && !isActive && (
        <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold text-white bg-accent-watching backdrop-blur-sm">
          <TrendingUp size={10} />
          Trending
        </div>
      )}
    </div>
  );
}

// ─── section ──────────────────────────────────────────────────────────────────

export default function DontMissSectionClient({ config }: { config: WatchingConfig }) {
  const { data } = useWatchingHero(config.type);
  const { openModalWithItem } = useWatching();
  const [activeIndex, setActiveIndex] = useState(0);

  if (!data) return <DontMissSkeleton />;

  // dedup: never show the same item twice (trending may appear in recommendations)
  const trendingId = data.trending?.id;
  const recs  = (data.recommendations as any[]).filter((r) => r.id !== trendingId);
  const items = [data.trending, ...recs].filter(Boolean).slice(0, 6);
  if (items.length === 0) return null;

  return (
    <section className="mb-8">
      <div className="mb-3">
        <h3 className="text-base font-semibold tracking-tight text-text-primary">Trending</h3>
      </div>

      <div
        className="flex gap-3 h-60"
        onMouseLeave={() => setActiveIndex(0)}
      >
        {items.map((item, i) => (
          <DontMissCard
            key={`${item.id}-${i}`}
            item={item}
            isActive={activeIndex === i}
            isTrending={i === 0}
            isFirst={i < 3}
            onHover={() => setActiveIndex(i)}
            onAdd={() => openModalWithItem("wantToWatch", item)}
          />
        ))}
      </div>
    </section>
  );
}
