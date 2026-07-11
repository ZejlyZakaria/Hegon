/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BarChart3, MoreVertical, Star } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { CarouselNav } from "@/shared/components/ui/carousel-nav";
import { cn } from "@/shared/utils/utils";
import { toast } from "@/shared/utils/toast";
import { isDemoReadOnlyError } from "@/shared/utils/demo-guard";
import { SegmentedControl } from "@/shared/components/ui/segmented-control";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { FilterSelect } from "@/shared/components/ui/filter-select";
import { Hint } from "@/shared/components/ui/tooltip";
import { useSeasonEpisodes } from "../../hooks/useSeasonEpisodes";
import {
  useEpisodeHighlights,
  useAddEpisodeHighlight,
  useRemoveEpisodeHighlight,
  useSetEpisodeRating,
} from "../../hooks/useEpisodeHighlights";
import { EpisodeHeatmapModal } from "./EpisodeHeatmapModal";
import type { WatchingMedia } from "../../types";

type View = "all" | "highlights";
const HIGHLIGHT = "#f59e0b";                              // gold — "best episode"
const RATE_COLOR = "var(--color-accent-watching-vivid)"; // teal — your rating
const MAX_HIGHLIGHTS = 20;
const TMDB_STILL = "https://image.tmdb.org/t/p/w300";
// Same scale as the season rating in Watch History (5 → 10 in half-steps).
const RATING_VALUES = [10, 9.5, 9, 8.5, 8, 7.5, 7, 6.5, 6, 5.5, 5] as const;

// Heatmap is hidden until we ingest complete IMDb ratings (OMDb data is patchy —
// e.g. GoT S5E3 has no rating there). Flip to re-enable once that lands.
const HEATMAP_ENABLED = false;

// One episode card: still + star toggle, with number/title/overview below (like the
// IMDb episode viewer). `highlighted` = persistent gold star + ring; the star
// toggles the episode as a "best episode" (the merged Best Episodes feature).
function StillCard({
  still,
  line1,
  line2,
  overview,
  highlighted,
  rating,
  onToggle,
  onRate,
}: {
  still: string | null;
  line1: string;
  line2: string;
  overview?: string;
  highlighted: boolean;
  rating?: number | null;
  onToggle: () => void;
  onRate?: (rating: number | null) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const rated = rating != null;
  const hasActions = !!onRate;

  return (
    <div className="group relative w-66 shrink-0">
      <div className="relative aspect-video overflow-hidden rounded-card border border-border-subtle transition-transform duration-300 ease-out group-hover:z-10 group-hover:scale-[1.03]">
        {still ? (
          <img src={still} alt={line2} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-surface-2 text-xs text-text-tertiary">
            No image
          </div>
        )}

        {/* Top-right — best-ep indicator (gold star) + "…" menu = single control surface */}
        {hasActions && (
          <div className="absolute right-2 top-2 z-10 flex items-center gap-1.5">
            {highlighted && (
              <Hint label="Best episode">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black/55 ring-1 ring-white/15 backdrop-blur-md">
                  <Star size={13} style={{ color: HIGHLIGHT, fill: HIGHLIGHT }} />
                </span>
              </Hint>
            )}
            <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white/85 ring-1 ring-white/15 backdrop-blur-md transition-all hover:bg-black/75 hover:text-white",
                    highlighted ? "opacity-100" : "opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100",
                  )}
                >
                  <MoreVertical size={14} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60 rounded-xl border-border-default bg-surface-3 p-1 shadow-md">
                <DropdownMenuItem
                  onClick={onToggle}
                  className="gap-2.5 px-3 py-2 text-xs text-text-secondary focus:bg-surface-2 focus:text-text-primary"
                >
                  <Star size={13} style={{ color: HIGHLIGHT, fill: highlighted ? HIGHLIGHT : "transparent" }} />
                  {highlighted ? "Remove from best episode" : "Mark as best episode"}
                </DropdownMenuItem>

                <div className="my-1 h-px bg-border-default" />

                {/* Rating — values shown directly (no nested select), menu stays open */}
                <div className="px-2 pb-1.5 pt-1">
                  <p className="mb-1.5 flex items-center gap-1.5 px-1 text-[10px] font-semibold uppercase tracking-wide text-text-tertiary">
                    <Star size={11} style={{ color: RATE_COLOR, fill: RATE_COLOR }} />
                    Your rating
                  </p>
                  <div className="grid grid-cols-6 gap-1">
                    {RATING_VALUES.map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => { onRate(n); setMenuOpen(false); }}
                        className={cn(
                          "flex h-7 items-center justify-center rounded-md text-[11px] font-semibold tabular-nums transition-colors",
                          rating === n ? "text-white" : "bg-surface-2 text-text-secondary hover:bg-surface-1 hover:text-text-primary",
                        )}
                        style={rating === n ? { backgroundColor: RATE_COLOR } : undefined}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  {rated && (
                    <button
                      type="button"
                      onClick={() => { onRate(null); setMenuOpen(false); }}
                      className="mt-1.5 w-full rounded-md py-1 text-[11px] font-medium text-text-tertiary transition-colors hover:text-text-primary"
                    >
                      Clear rating
                    </button>
                  )}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        {/* Bottom-right — rating DISPLAY only (teal ★ + value), not interactive */}
        {hasActions && rated && (
          <div className="pointer-events-none absolute bottom-2 right-2 z-10">
            <span className="flex h-6 items-center gap-1 rounded-full bg-black/55 px-1.5 ring-1 ring-white/15 backdrop-blur-md">
              <Star size={11} style={{ color: RATE_COLOR, fill: RATE_COLOR }} />
              <span className="text-[11px] font-semibold tabular-nums" style={{ color: RATE_COLOR }}>{rating}</span>
            </span>
          </div>
        )}
      </div>

      {/* Number · title · overview */}
      <div className="mt-2">
        <p className="text-[10px] font-medium text-text-tertiary">{line1}</p>
        <p className="truncate text-xs font-semibold text-text-primary">{line2}</p>
        {overview && (
          <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-text-tertiary">{overview}</p>
        )}
      </div>
    </div>
  );
}

export function Episodes({ media, currentSeason, readOnly = false }: { media: WatchingMedia; currentSeason?: number; readOnly?: boolean }) {
  const seasonCount = media.season_episodes?.length ?? media.seasons ?? 1;
  const [view, setView] = useState<View>("all");
  const [season, setSeason] = useState(
    currentSeason && currentSeason <= seasonCount ? currentSeason : 1,
  );
  const [heatmapOpen, setHeatmapOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Switching season starts the row from the beginning, not wherever you'd scrolled.
  useEffect(() => {
    scrollRef.current?.scrollTo({ left: 0 });
  }, [season, view]);

  const { data: episodes = [], isLoading } = useSeasonEpisodes(
    media.tmdb_id ?? 0,
    season,
    !!media.tmdb_id && view === "all",
  );
  const { data: marks = [] } = useEpisodeHighlights(media.id);
  const addHighlight = useAddEpisodeHighlight(media.id);
  const removeHighlight = useRemoveEpisodeHighlight(media.id);
  const setRating = useSetEpisodeRating(media.id);

  // Rows are per-episode marks: highlighted (best ep) and/or rated.
  const highlightRows = useMemo(() => marks.filter((h) => h.highlighted), [marks]);
  const highlightMap = useMemo(
    () => new Map(highlightRows.map((h) => [`${h.season}-${h.episode}`, h.id])),
    [highlightRows],
  );
  const ratingMap = useMemo(
    () => new Map(marks.filter((h) => h.rating != null).map((h) => [`${h.season}-${h.episode}`, h.rating as number])),
    [marks],
  );

  const handleRate = async (
    s: number,
    e: number,
    meta: { title: string | null; still_path: string | null },
    rating: number | null,
  ) => {
    try {
      await setRating.mutateAsync({
        userId: media.user_id,
        orgId: media.org_id,
        season: s,
        episode: e,
        rating,
        title: meta.title,
        still_path: meta.still_path,
      });
    } catch (err) {
      if (isDemoReadOnlyError(err)) return;
      toast.error("Failed to save rating.");
    }
  };

  const toggleHighlight = async (s: number, e: number) => {
    const existingId = highlightMap.get(`${s}-${e}`);
    if (!existingId && highlightRows.length >= MAX_HIGHLIGHTS) {
      toast.error(`You can pin up to ${MAX_HIGHLIGHTS} best episodes.`);
      return;
    }
    try {
      if (existingId) {
        await removeHighlight.mutateAsync(existingId);
      } else {
        await addHighlight.mutateAsync({
          tmdbId: media.tmdb_id!,
          userId: media.user_id,
          orgId: media.org_id,
          season: s,
          episode: e,
        });
      }
    } catch (err) {
      if (isDemoReadOnlyError(err)) return;
      toast.error(err instanceof Error ? err.message : "Failed to update.");
    }
  };

  if (!media.tmdb_id || seasonCount < 1) return null;

  const scroll = (dir: number) => scrollRef.current?.scrollBy({ left: dir * 560, behavior: "smooth" });
  const showChevrons = (view === "all" ? episodes.length : highlightRows.length) > 3;

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-title text-text-primary">Episodes</h2>
        <div className="flex items-center gap-1.5">
          {/* No All/Highlights toggle when read-only — there are no highlights on an unwatched title */}
          {!readOnly && (
            <SegmentedControl<View>
              size="sm"
              value={view}
              onChange={setView}
              items={[
                { value: "all", label: "All" },
                { value: "highlights", label: highlightRows.length ? `Highlights ${highlightRows.length}` : "Highlights" },
              ]}
            />
          )}
          {showChevrons && <CarouselNav size="md" onPrev={() => scroll(-1)} onNext={() => scroll(1)} />}
          {HEATMAP_ENABLED && (
            <Button variant="quiet" size="sm" onClick={() => setHeatmapOpen(true)}>
              <BarChart3 />
              Ratings
            </Button>
          )}
        </div>
      </div>

      {/* Season selector — All view only. Chips up to 10; beyond that (One Piece: 23)
          a wall of chips is unusable → collapse into a Select. */}
      {view === "all" && seasonCount > 1 && (
        seasonCount > 10 ? (
          <div className="mb-3">
            <FilterSelect
              size="sm"
              className="w-40"
              value={String(season)}
              onChange={(v) => setSeason(Number(v))}
              options={Array.from({ length: seasonCount }, (_, i) => ({
                value: String(i + 1),
                label: `Season ${i + 1}`,
              }))}
              aria-label="Season"
            />
          </div>
        ) : (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {Array.from({ length: seasonCount }, (_, i) => i + 1).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSeason(s)}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
                  s === season
                    ? "bg-accent-watching text-white"
                    : "bg-surface-2 text-text-tertiary hover:bg-surface-3 hover:text-text-secondary",
                )}
              >
                S{s}
              </button>
            ))}
          </div>
        )
      )}

      {/* ── All: this season's episodes ── */}
      {view === "all" ? (
        isLoading ? (
          <div className="-ml-2 flex gap-3 overflow-x-auto scrollbar-hide py-2 pl-2 pr-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="aspect-video w-66 shrink-0 animate-pulse rounded-card bg-surface-2" />
            ))}
          </div>
        ) : episodes.length === 0 ? (
          <p className="py-6 text-center text-xs text-text-tertiary">No episodes found.</p>
        ) : (
          <div ref={scrollRef} className="-ml-2 flex gap-3 overflow-x-auto scrollbar-hide py-2 pl-2 pr-2">
            {episodes.map((ep) => (
              <StillCard
                key={ep.number}
                still={ep.still_url}
                line1={`Episode ${ep.number}`}
                line2={ep.name}
                overview={ep.overview}
                highlighted={highlightMap.has(`${season}-${ep.number}`)}
                rating={ratingMap.get(`${season}-${ep.number}`) ?? null}
                onToggle={readOnly ? () => {} : () => toggleHighlight(season, ep.number)}
                onRate={readOnly ? undefined : (r) => handleRate(season, ep.number, {
                  title: ep.name,
                  still_path: ep.still_url ? ep.still_url.replace(TMDB_STILL, "") : null,
                }, r)}
              />
            ))}
          </div>
        )
      ) : (
        /* ── Highlights: starred episodes across all seasons ── */
        highlightRows.length === 0 ? (
          <p className="py-6 text-center text-xs text-text-tertiary">
            Star an episode in <span className="text-text-secondary">All</span> to pin your best moments here.
          </p>
        ) : (
          <div ref={scrollRef} className="-ml-2 flex gap-3 overflow-x-auto scrollbar-hide py-2 pl-2 pr-2">
            {highlightRows.map((h) => (
              <StillCard
                key={h.id}
                still={h.still_path ? `${TMDB_STILL}${h.still_path}` : null}
                line1={`S${h.season} · E${h.episode}`}
                line2={h.title ?? `Episode ${h.episode}`}
                highlighted
                rating={ratingMap.get(`${h.season}-${h.episode}`) ?? null}
                onToggle={() => toggleHighlight(h.season, h.episode)}
                onRate={(r) => handleRate(h.season, h.episode, { title: h.title, still_path: h.still_path }, r)}
              />
            ))}
          </div>
        )
      )}

      {HEATMAP_ENABLED && (
        <EpisodeHeatmapModal open={heatmapOpen} onClose={() => setHeatmapOpen(false)} media={media} />
      )}
    </section>
  );
}
