/* eslint-disable @next/next/no-img-element */
"use client";

import { useMemo, useRef } from "react";
import { Star } from "lucide-react";
import { CarouselNav } from "@/shared/components/ui/carousel-nav";
import { isEpisodeActionable } from "../../lib/series-state";
import { flatToCour } from "../../lib/anime-overlay";
import { toast } from "@/shared/utils/toast";
import { isDemoReadOnlyError } from "@/shared/utils/demo-guard";
import { Hint } from "@/shared/components/ui/tooltip";
import { SectionHeader } from "@/shared/components/ui/section-header";
import { useEpisodeHighlights, useRemoveEpisodeHighlight } from "../../hooks/useEpisodeHighlights";
import type { WatchingMedia, AnimeCour, EpisodeHighlight } from "../../types";

/**
 * BEST EPISODES — the curation, on the page. The catalogue (every season, every episode) lives in
 * the season panel now, one card up; this rail is only what YOU starred, across every season, read
 * straight from `episode_highlights` — title, still, air date and synopsis were photographed the
 * moment you starred, so the rail never asks TMDB for anything.
 *
 * This file used to be the whole episode browser (All / Highlights, season chips, per-episode
 * rating in a "…" menu). The browser moved into the panel; the rating and the "…" were dropped
 * (decisions.md 2026-09-14): a card has ONE affordance, the star, and it toggles.
 */

/**
 * THE WHOLE CARD, NOT JUST ITS PICTURE.
 *
 * A skeleton that reserves the still and nothing else, while a real card is still PLUS number,
 * title and a two-line overview, stands short and grows the moment the episodes land — shoving
 * whatever sits below down the page, under the reader's eye. A placeholder that is not the size
 * of what it replaces does not prevent the jump; it schedules it.
 *
 * Exported so the full-page skeletons (`DetailSkeleton`, `DiscoverSkeleton`) hold this exact
 * shape too. Mirrors StillCard's own markup below (mt-2, the three lines) so the two cannot drift.
 */
export function EpisodeCardsSkeleton({ n = 5 }: { n?: number }) {
  // `py-2` reserves room for the hover scale on the VERTICAL axis; the negative margin cancels the
  // edge padding so the row still bleeds where it did, and a card growing ~4px sideways is not
  // clipped by its own `overflow-x-auto`.
  return (
    <div className="-mx-4 flex gap-3 overflow-x-auto scroll-px-4 px-4 py-2 scrollbar-hide sm:-mx-1.5 sm:px-1.5 sm:scroll-px-1.5">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="w-66 shrink-0">
          <div className="aspect-video w-full animate-pulse rounded-card bg-surface-2" />
          {/* Each <p> keeps the REAL typography class, so the block takes its height from the same
              line-heights as the text it replaces. A line of 11px text only INKS about a third of
              its line box, so the bar is shorter than its line and centred in it. The title's bar
              is 10px, the quiet caption and overview 8px — hierarchy rides the same property as
              real ink. Two overview bars, the second half-width, because the real one is clamped
              to two lines and a paragraph's last line stops early. */}
          <div className="mt-2">
            <p className="mb-0.5 text-micro font-medium">
              <span className="inline-block h-2 w-16 animate-pulse rounded-full bg-surface-2 align-middle" />
            </p>
            <p className="text-xs font-semibold">
              <span className="inline-block h-2.5 w-2/3 animate-pulse rounded-full bg-surface-2 align-middle" />
            </p>
            <p className="mt-1 text-micro leading-relaxed">
              <span className="inline-block h-2 w-full animate-pulse rounded-full bg-surface-2 align-middle" />
              <span className="inline-block h-2 w-1/2 animate-pulse rounded-full bg-surface-2 align-middle" />
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

const GOLD = "var(--color-gold)";
// A rail card is 264 px wide — 528 physical on a retina screen; `w300` was visibly soft.
const TMDB_STILL = "https://image.tmdb.org/t/p/w500";
const fmtAir = (d: string) =>
  new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

/**
 * One best episode: still + the star, with number · title · overview below (like the IMDb episode
 * viewer). THE STAR IS INSIDE THE FRAME THAT SCALES — the whole card is one object, and it zooms
 * as one on hover, marks included, like every poster card. It used to sit outside so a Radix menu
 * anchored to it wouldn't drift; the menu is gone, so is the reason. The star is always lit (this
 * IS a best episode); hovering it says what a click does, and a click does it: one gesture.
 */
function StillCard({
  still, line1, line2, overview, onRemove, backdrop,
}: {
  still: string | null;
  line1: string;
  line2: string;
  overview: string | null;
  onRemove: () => void;
  /** The SHOW's backdrop — stands in for a still TMDB never had. */
  backdrop: string | null;
}) {
  return (
    <div className="group relative w-66 shrink-0">
      <div className="relative aspect-video overflow-hidden rounded-card border border-border-subtle transition-transform duration-300 ease-out group-hover:z-10 group-hover:scale-[1.03]">
        {still ? (
          <img src={still} alt={line2} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <>
            {backdrop ? (
              <img src={backdrop} alt="" aria-hidden loading="lazy" className="absolute inset-0 h-full w-full scale-105 object-cover opacity-80 blur-[2px] saturate-75" />
            ) : (
              <div className="absolute inset-0 bg-surface-2" />
            )}
            <div className="absolute inset-0 bg-linear-to-t from-black/55 via-black/15 to-black/25" />
          </>
        )}

        <Hint label="Remove from best episodes">
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remove from best episodes"
            className="on-artwork absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full transition-opacity duration-150 ease-out hover:opacity-80"
          >
            <Star size={13} style={{ color: GOLD, fill: GOLD }} />
          </button>
        </Hint>
      </div>

      {/* Number · title · overview. The number is an EYEBROW: it belongs to the title, so it sits
          closer to it (2px) than the overview does (4px). */}
      <div className="mt-2">
        <p className="mb-0.5 text-micro font-medium text-text-tertiary">{line1}</p>
        <p className="truncate text-xs font-semibold text-text-primary">{line2}</p>
        {overview && (
          <p className="mt-1 line-clamp-2 text-micro leading-relaxed text-text-tertiary">{overview}</p>
        )}
      </div>
    </div>
  );
}

export function Episodes({ media, readOnly = false, cours }: { media: WatchingMedia; readOnly?: boolean; cours?: AnimeCour[] }) {
  // Anime v2: marks are stored in TMDB coordinates (season 1 + the FLAT episode number) while the
  // cours are what you say out loud. The cours are the lens for this rail.
  const overlayOn = !!cours && cours.length > 0;
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: marks = [] } = useEpisodeHighlights(readOnly ? "" : media.id);
  const removeHighlight = useRemoveEpisodeHighlight(media.id);

  /**
   * STOP READING A CLAIM YOU AREN'T MAKING. A star on a season you have never reached (True
   * Detective is an anthology: you watched S1, S4's star sat in your highlights) is a true fact
   * the day you get there, and it comes back by itself when you do. Same rule as season years.
   */
  const rows = useMemo(
    () => marks.filter((h) => h.highlighted && isEpisodeActionable(media, h.season, h.episode)),
    [marks, media],
  );

  const remove = async (h: EpisodeHighlight) => {
    try {
      await removeHighlight.mutateAsync(h.id);
    } catch (err) {
      if (isDemoReadOnlyError(err)) return;
      toast.error(err instanceof Error ? err.message : "Failed to update.");
    }
  };

  // Nothing to curate on a title you have not watched; no section at all without a best episode —
  // an empty rail with a hint is chrome around nothing, and the star lives in the season panel.
  if (readOnly || !media.tmdb_id || rows.length === 0) return null;

  const scroll = (dir: number) => scrollRef.current?.scrollBy({ left: dir * 560, behavior: "smooth" });

  return (
    <section>
      <SectionHeader
        title="Best Episodes"
        actions={rows.length > 3 ? <CarouselNav size="md" onPrev={() => scroll(-1)} onNext={() => scroll(1)} /> : undefined}
      />
      <div ref={scrollRef} className="-mx-4 flex gap-3 overflow-x-auto scroll-px-4 px-4 py-2 scrollbar-hide sm:-mx-1.5 sm:px-1.5 sm:scroll-px-1.5">
        {rows.map((h) => {
          // The coordinate people SAY: a cour and its own number under the overlay, else the row.
          const at = overlayOn ? flatToCour(h.episode, cours!) : { season: h.season, episode: h.episode };
          return (
            <StillCard
              key={h.id}
              still={h.still_path ? `${TMDB_STILL}${h.still_path}` : null}
              line1={h.air_date ? `S${at.season}.E${at.episode} · ${fmtAir(h.air_date)}` : `S${at.season}.E${at.episode}`}
              line2={h.title ?? `Episode ${at.episode}`}
              overview={h.overview}
              backdrop={media.backdrop_url ?? null}
              onRemove={() => remove(h)}
            />
          );
        })}
      </div>
    </section>
  );
}
