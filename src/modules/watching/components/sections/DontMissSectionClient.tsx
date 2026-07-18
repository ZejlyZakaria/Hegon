/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Plus, TrendingUp } from "lucide-react";
import { Badge } from "@/shared/components/ui/badge";
import { ScoreMark } from "@/modules/watching/components/shared/Marks";
import { mapTmdbGenres } from "@/modules/watching/lib/media-utils";
import { useWatchingHero } from "@/modules/watching/hooks/useWatchingHero";
import { useOwnedTmdbIds } from "@/modules/watching/hooks/useOwnedTmdbIds";
import { useCurrentUserId } from "@/shared/hooks/useCurrentUserId";
import { useWatching } from "@/modules/watching/components/WatchingClient";
import { DontMissSkeleton } from "@/modules/watching/components/shared/WatchingSkeletons";
import type { WatchingConfig } from "@/modules/watching/types";

const TMDB_W500 = "https://image.tmdb.org/t/p/w500";
const CARD_BG   = "var(--color-surface-0)";
const EXP       = 22;   // 22/(22+7×4) = 44%
const COL       = 7;    // 7/50         = 14%
// card row height = h-60 = 240px → portrait poster width = 240 × 2/3 = 160px
const POSTER_W  = 160;

// ─── card ─────────────────────────────────────────────────────────────────────

function DontMissCard({
  item,
  isActive,
  isTrending,
  isFirst,
  isOwned,
  onHover,
  onAdd,
}: {
  item: any;
  isActive: boolean;
  isTrending: boolean;
  isFirst: boolean;
  isOwned: boolean;
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
      className="relative rounded-card overflow-hidden cursor-pointer min-w-0 ring-1 ring-inset ring-white/10"
      style={{
        flex: isActive ? EXP : COL,
        transition: "flex 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
        backgroundColor: CARD_BG,
      }}
      onMouseEnter={onHover}
    >
      {/* ── ambient: the poster's own artwork, blurred, always fills the card so the
            area beside the sharp poster reads as glow, never a flat dark panel ── */}
      {posterUrl && (
        <div className="absolute inset-0">
          <Image src={posterUrl} alt="" aria-hidden fill unoptimized sizes="50vw" className="scale-[1.7] object-cover blur-3xl" />
          <div className="absolute inset-0 bg-black/40" />
        </div>
      )}

      {/* ── portrait poster — left-anchored, natural 2:3 dimensions. Pulses while
            the image streams (data is instant from the DB cache, posters aren't). ── */}
      <div
        className={`absolute left-0 top-0 bottom-0 bg-surface-2 ${posterLoaded ? "" : "animate-pulse"}`}
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
            animate={{ opacity: 1, transition: { duration: 0.22, delay: 0.15 } }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
            className="absolute inset-0"
          >
            {/* darken toward the info side; the sharp poster melts into its own blurred art */}
            <div className="absolute inset-0 bg-linear-to-r from-transparent via-black/35 to-black/65" />

            {/* info panel — starts right after the poster */}
            <div
              className="absolute right-0 top-0 bottom-0 flex flex-col justify-end pb-5 pr-6 pl-5 min-w-0"
              style={{ left: `${POSTER_W}px` }}
            >
              {genres.length > 0 && (
                <div className="flex gap-1.5 flex-wrap mb-2">
                  {genres.map((g) => (
                    // Same quiet pill as the detail hero — genres read as one style across the app.
                    <span key={g} className="rounded-full bg-white/6 px-2 py-0.5 text-micro text-white/40 ring-1 ring-white/6">
                      {g}
                    </span>
                  ))}
                </div>
              )}

              <h3 className="text-base font-bold text-white leading-snug line-clamp-2 mb-1.5 min-h-11">
                {title}
              </h3>

              <div className="flex items-center gap-2.5 mb-2">
                {/* The WORLD's score → gold. Yours would be teal — same mark, different source. */}
                {rating && <ScoreMark value={rating} source="world" size="md" />}
                {year && <span className="text-xs text-white/40">{year}</span>}
              </div>

              {item.overview && (
                <p className="text-micro text-white/60 line-clamp-3 leading-relaxed mb-3 min-h-[3.3rem]">
                  {item.overview}
                </p>
              )}

              {/* Already yours → don't offer to "add" it. A trending rail that invites you to add a
                  film you finished last week is the app not knowing what you own. */}
              {isOwned ? (
                <div className="self-start flex items-center gap-1.5 rounded-control bg-white/12 px-3 py-2 text-xs font-semibold text-white/75">
                  <Check size={12} />
                  In your library
                </div>
              ) : (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onAdd(); }}
                  className="self-start flex items-center gap-1.5 rounded-control bg-white px-3 py-2 text-xs font-semibold text-accent-watching transition-[transform,opacity] duration-150 ease-out hover:opacity-90 active:scale-[0.98]"
                >
                  <Plus size={12} />
                  Add to collection
                </button>
              )}

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
              <p className="truncate text-micro font-semibold text-white">{title}</p>
              {rating && <ScoreMark value={rating} source="world" />}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── trending — a FLAG on artwork, so: glass. It was `solid`, a filled teal slab that
             punched a hole in the poster; the whole point of the flag grammar is that the
             material is chosen by the SURFACE, and this surface is an image. ── */}
      {isTrending && (
        <Badge
          variant="flag"
          size="md"
          uppercase
          color="var(--color-accent-watching-vivid)"
          className="absolute left-3 top-3 z-10"
        >
          <TrendingUp size={10} />
          Trending
        </Badge>
      )}
    </div>
  );
}

// ─── mobile card (swipeable rail; the hover-accordion is desktop-only) ─────────

function TrendingMobileCard({
  item,
  isTrending,
  isOwned,
  onAdd,
}: {
  item: any;
  isTrending: boolean;
  isOwned: boolean;
  onAdd: () => void;
}) {
  const posterUrl = item.poster_path ? `${TMDB_W500}${item.poster_path}` : null;
  const title  = item.title || item.name;
  const rating = item.vote_average?.toFixed(1);

  return (
    <button
      type="button"
      onClick={onAdd}
      className="relative shrink-0 w-[42%] aspect-2/3 snap-start overflow-hidden rounded-tile bg-surface-2 text-left"
    >
      {posterUrl && (
        <Image src={posterUrl} alt={title} fill unoptimized sizes="128px" className="object-cover" />
      )}
      <div className="absolute inset-0 bg-linear-to-t from-black/85 via-black/10 to-transparent" />
      {/* Owned → a quiet check, top-right, so the rail doesn't pretend it's new to you. */}
      {isOwned && (
        <span className="on-artwork absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full">
          <Check size={12} className="text-white" />
        </span>
      )}
      {isTrending && (
        <Badge
          variant="flag"
          size="sm"
          uppercase
          color="var(--color-accent-watching-vivid)"
          className="absolute left-2 top-2"
        >
          <TrendingUp size={9} />
          Trending
        </Badge>
      )}
      <div className="absolute inset-x-0 bottom-0 p-2">
        <p className="truncate text-micro font-semibold text-white">{title}</p>
        {rating && <ScoreMark value={rating} source="world" className="mt-1" />}
      </div>
    </button>
  );
}

// ─── section ──────────────────────────────────────────────────────────────────

export default function DontMissSectionClient({ config }: { config: WatchingConfig }) {
  const { data } = useWatchingHero(config.type);
  const { openModalWithItem } = useWatching();
  const userId = useCurrentUserId();
  const { data: ownedIds = [] } = useOwnedTmdbIds(userId ?? "", config.type, !!userId);
  const owned = new Set(ownedIds);
  const [activeIndex, setActiveIndex] = useState(0);

  if (!data) return <DontMissSkeleton />;

  // dedup: never show the same item twice (trending may appear in recommendations)
  const trendingId = data.trending?.id;
  const recs  = (data.recommendations as any[]).filter((r) => r.id !== trendingId);
  const items = [data.trending, ...recs].filter(Boolean).slice(0, 6);
  if (items.length === 0) return null;

  return (
    <section>
      <div className="mb-1.5">
        <h3 className="text-title text-text-primary">Don&apos;t Miss</h3>
        <p className="mt-1 text-xs text-text-tertiary">Trending now, plus recent gems</p>
      </div>

      {/* Mobile: swipeable poster rail (hover-accordion can't work on touch).
          py-3 mirrors MediaCarousel so the header→content gap matches everywhere. */}
      <div className="flex gap-3 overflow-x-auto custom-scrollbar-hide snap-x snap-mandatory py-1.5 lg:hidden">
        {items.map((item, i) => (
          <TrendingMobileCard
            key={`m-${item.id}-${i}`}
            item={item}
            isTrending={i === 0}
            isOwned={owned.has(item.id)}
            onAdd={() => openModalWithItem("wantToWatch", item)}
          />
        ))}
      </div>

      {/* Desktop: hover-expand accordion. py-3 wrapper matches MediaCarousel's
          content padding so the header→content gap is identical across sections. */}
      <div className="hidden py-1.5 lg:block">
        <div className="flex h-60 gap-4" onMouseLeave={() => setActiveIndex(0)}>
          {items.map((item, i) => (
            <DontMissCard
              key={`${item.id}-${i}`}
              item={item}
              isActive={activeIndex === i}
              isTrending={i === 0}
              isFirst={i < 3}
              isOwned={owned.has(item.id)}
              onHover={() => setActiveIndex(i)}
              onAdd={() => openModalWithItem("wantToWatch", item)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
