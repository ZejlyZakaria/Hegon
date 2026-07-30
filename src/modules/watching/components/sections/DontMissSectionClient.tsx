/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Plus, TrendingUp } from "lucide-react";
import { Badge } from "@/shared/components/ui/badge";
import { ROW_VARS } from "@/modules/watching/lib/dont-miss-layout";
import { ScoreMark } from "@/modules/watching/components/shared/Marks";
import { mapTmdbGenres } from "@/modules/watching/lib/media-utils";
import { tmdbImage, tmdbImageFor } from "@/modules/watching/lib/tmdb-image";
import { useWatchingHero } from "@/modules/watching/hooks/useWatchingHero";
import { useOwnedTmdbIds } from "@/modules/watching/hooks/useOwnedTmdbIds";
import { useCurrentUserId } from "@/shared/hooks/useCurrentUserId";
import { useWatching } from "@/modules/watching/components/WatchingClient";
import { DontMissSkeleton } from "@/modules/watching/components/shared/WatchingSkeletons";
import type { WatchingConfig } from "@/modules/watching/types";

const TMDB_W500 = "https://image.tmdb.org/t/p/w500";
const CARD_BG   = "var(--color-surface-0)";
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
        // EVERY card's basis is its poster, so a closed one is EXACTLY its artwork — no dead strip
        // beside it, and nothing cropped off it. Only the open card grows (`flex-grow: 1`), so it
        // alone absorbs whatever the row has left over.
        flex: isActive
          ? "1 1 calc(var(--dm-poster) + var(--dm-panel))"
          : "0 1 var(--dm-poster)",
        // The open card's floor rides the BASIS, never `min-width`. min-width does not animate: it
        // applied the instant you hovered, so the card jumped 320px wide and only then began to
        // slide — a snap followed by a glide, which is what read as "not fitting".
        // A curve that leaves fast and settles slowly, instead of the symmetric material easing.
        transition:
          "flex-basis 0.5s cubic-bezier(0.32, 0.72, 0, 1), flex-grow 0.5s cubic-bezier(0.32, 0.72, 0, 1)",
        backgroundColor: CARD_BG,
      }}
      onMouseEnter={onHover}
    >
      {/* ── ambient: the poster's own artwork, blurred, always fills the card so the
            area beside the sharp poster reads as glow, never a flat dark panel ── */}
      {posterUrl && (
        <div className="absolute inset-0">
          {/* It is blurred into a glow at blur-3xl — nobody can see a pixel of it. Asking for a
              full-size poster here downloaded the SAME image twice per card, the second copy only
              to be destroyed. w92 is indistinguishable once blurred and ~2 KB. */}
          <Image src={tmdbImage(posterUrl, "w92") || posterUrl} alt="" aria-hidden fill loading="lazy" sizes="96px" className="scale-[1.7] object-cover blur-3xl" />
          <div className="absolute inset-0 bg-black/40" />
        </div>
      )}

      {/* ── portrait poster — left-anchored, natural 2:3 dimensions. Pulses while
            the image streams (data is instant from the DB cache, posters aren't). ── */}
      <div
        className={`absolute left-0 top-0 bottom-0 bg-surface-2 ${posterLoaded ? "" : "animate-pulse"}`}
        style={{ aspectRatio: "2/3" }}
      >
        {/* Only the FIRST card leads the page — it is the one above the fold, and the only one that
            earns `eager`. All six were claiming it, which is how this rail alone fired twelve
            immediate fetches that raced the rest of the page. */}
        {posterUrl && (
          <Image
            src={tmdbImageFor(posterUrl, 220) || posterUrl}
            alt={title}
            fill
            className="object-cover transition-opacity duration-200"
            style={{ opacity: posterLoaded ? 1 : 0 }}
            sizes="(max-width: 1024px) 45vw, 240px"
            loading={isFirst ? "eager" : "lazy"}
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
            // Early, and it can be: with the panel's width fixed there is no re-flow left to hide.
            animate={{ opacity: 1, transition: { duration: 0.26, delay: 0.12 } }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
            className="absolute inset-0"
          >
            {/* darken toward the info side; the sharp poster melts into its own blurred art */}
            <div className="absolute inset-0 bg-linear-to-r from-transparent via-black/35 to-black/65" />

            {/* Info panel — anchored after the poster, and WIDTH-FIXED, not `right-0`. Pinned to
                the right edge it inherited the card's animating width, so every line inside it was
                re-laid-out on every frame. Given the open card's final width it is laid out once,
                from the first frame; the card opening merely uncovers it. */}
            <div
              className="absolute top-0 bottom-0 flex flex-col justify-end pb-5 pr-6 pl-5"
              style={{ left: "var(--dm-poster)", width: "var(--dm-panel)" }}
            >
              {genres.length > 0 && (
                // ONE line, always. The panel is 320px and three long genres ("Science Fiction",
                // "Action & Adventure"…) overflowed it, so the row wrapped and grew a second line
                // of pills. Genres are a glance, not a list: they shrink and ellipsise rather than
                // take a line the title should have had.
                <div className="mb-2 flex flex-nowrap gap-1.5 overflow-hidden">
                  {/* `overlay` is the variant written for this — "ON ARTWORK, for METADATA
                      (genres)", in badge.tsx's own words — and it replaces a hand-rolled pill that
                      only claimed in a comment to match the hero.
                      The COLOUR is not the hero's, though, and that is the point: a genre is
                      metadata and must never outweigh the title it describes. The hero's title is
                      4xl, so 0.8 white sits under it comfortably; here the title is `text-base`,
                      and 0.8 made the genres the brightest thing in the panel — louder than the
                      name of the film. Same primitive, weight tuned to the title it serves. */}
                  {genres.map((g) => (
                    <Badge key={g} variant="overlay" size="md" color="rgba(255,255,255,0.45)" className="min-w-0 shrink">
                      <span className="truncate">{g}</span>
                    </Badge>
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
          className="absolute left-2 top-2 z-10"
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
      // Phone: 42% ≈ 2 cards + a peek of the 3rd in the scroll rail. From md up the parent becomes a
      // 6-column grid, so the card hands its width to the grid (w-auto) — all 6 visible, no scroll.
      className="relative shrink-0 w-[42%] md:w-auto aspect-2/3 snap-start overflow-hidden rounded-tile bg-surface-2 text-left"
    >
      {posterUrl && (
        <Image src={tmdbImageFor(posterUrl, 170) || posterUrl} alt={title} fill loading="lazy" sizes="(max-width: 1024px) 45vw, 180px" className="object-cover" />
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
  const { openTitle } = useWatching();
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

      {/* Touch (any width) + every narrow screen — the accordion is a HOVER interaction, so the
          split is by pointer, not width (`lg:can-hover:hidden` hides this only when ≥lg AND mouse).
          Below md: a swipeable poster rail. From md up (tablets): the 6 items fit at once, so it
          becomes a static 6-up grid — no scroll, matching the page's grid density. */}
      <div className="flex gap-3 overflow-x-auto custom-scrollbar-hide snap-x snap-mandatory py-1.5 md:grid md:grid-cols-6 md:overflow-visible md:snap-none lg:can-hover:hidden">
        {items.map((item, i) => (
          <TrendingMobileCard
            key={`m-${item.id}-${i}`}
            item={item}
            isTrending={i === 0}
            isOwned={owned.has(item.id)}
            onAdd={() => openTitle(item)}
          />
        ))}
      </div>

      {/* Desktop with a mouse: hover-expand accordion. Shown only when ≥lg AND the pointer can
          hover — never on a touch tablet, however wide, where it would be a dead accordion. */}
      <div className="hidden py-1.5 lg:can-hover:block">
        <div className={`flex gap-4 ${ROW_VARS}`} onMouseLeave={() => setActiveIndex(0)}>
          {items.map((item, i) => (
            <DontMissCard
              key={`${item.id}-${i}`}
              item={item}
              isActive={activeIndex === i}
              isTrending={i === 0}
              isFirst={i < 3}
              isOwned={owned.has(item.id)}
              onHover={() => setActiveIndex(i)}
              onAdd={() => openTitle(item)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
