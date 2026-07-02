/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BarChart3, ChevronLeft, ChevronRight, Star } from "lucide-react";
import { cn } from "@/shared/utils/utils";
import { toast } from "@/shared/utils/toast";
import { isDemoReadOnlyError } from "@/shared/utils/demo-guard";
import { SegmentedControl } from "@/shared/components/ui/segmented-control";
import { useSeasonEpisodes } from "../../hooks/useSeasonEpisodes";
import {
  useEpisodeHighlights,
  useAddEpisodeHighlight,
  useRemoveEpisodeHighlight,
} from "../../hooks/useEpisodeHighlights";
import { EpisodeHeatmapModal } from "./EpisodeHeatmapModal";
import type { WatchingMedia } from "../../types";

type View = "all" | "highlights";
const HIGHLIGHT = "#f59e0b";
const MAX_HIGHLIGHTS = 20;

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
  onToggle,
}: {
  still: string | null;
  line1: string;
  line2: string;
  overview?: string;
  highlighted: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="group relative w-66 shrink-0">
      <div className="relative aspect-video overflow-hidden rounded-xl border border-border-subtle transition-transform duration-300 ease-out group-hover:z-10 group-hover:scale-[1.03]">
        {still ? (
          <img src={still} alt={line2} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-surface-2 text-xs text-text-tertiary">
            No image
          </div>
        )}

        {/* Star toggle — always visible when highlighted, on hover otherwise */}
        <button
          type="button"
          onClick={onToggle}
          title={highlighted ? "Remove from best episodes" : "Mark as best episode"}
          className={cn(
            "absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/55 ring-1 ring-white/15 backdrop-blur-md transition-all hover:bg-black/75",
            highlighted ? "opacity-100" : "opacity-0 group-hover:opacity-100",
          )}
        >
          <Star
            size={13}
            style={highlighted ? { color: HIGHLIGHT, fill: HIGHLIGHT } : undefined}
            className={highlighted ? "" : "text-white/85"}
          />
        </button>
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

export function Episodes({ media, currentSeason }: { media: WatchingMedia; currentSeason?: number }) {
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
  const { data: highlights = [] } = useEpisodeHighlights(media.id);
  const addHighlight = useAddEpisodeHighlight(media.id);
  const removeHighlight = useRemoveEpisodeHighlight(media.id);

  // "s-e" → highlight id, for the star toggle + persistent gold state.
  const highlightMap = useMemo(
    () => new Map(highlights.map((h) => [`${h.season}-${h.episode}`, h.id])),
    [highlights],
  );

  const toggleHighlight = async (s: number, e: number) => {
    const existingId = highlightMap.get(`${s}-${e}`);
    if (!existingId && highlights.length >= MAX_HIGHLIGHTS) {
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
  const showChevrons = (view === "all" ? episodes.length : highlights.length) > 3;

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-title text-text-primary">Episodes</h2>
        <div className="flex items-center gap-1.5">
          <SegmentedControl<View>
            size="sm"
            value={view}
            onChange={setView}
            items={[
              { value: "all", label: "All" },
              { value: "highlights", label: highlights.length ? `Highlights ${highlights.length}` : "Highlights" },
            ]}
          />
          {showChevrons && (
            <>
              <button type="button" onClick={() => scroll(-1)} className="flex h-7 w-7 items-center justify-center rounded-lg border border-border-subtle bg-surface-2 text-text-tertiary transition-colors hover:text-text-primary">
                <ChevronLeft size={14} />
              </button>
              <button type="button" onClick={() => scroll(1)} className="flex h-7 w-7 items-center justify-center rounded-lg border border-border-subtle bg-surface-2 text-text-tertiary transition-colors hover:text-text-primary">
                <ChevronRight size={14} />
              </button>
            </>
          )}
          {HEATMAP_ENABLED && (
            <button
              type="button"
              onClick={() => setHeatmapOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border border-border-subtle bg-surface-2 px-2.5 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-3 hover:text-text-primary"
            >
              <BarChart3 size={13} />
              Ratings
            </button>
          )}
        </div>
      </div>

      {/* Season selector — All view only */}
      {view === "all" && seasonCount > 1 && (
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
      )}

      {/* ── All: this season's episodes ── */}
      {view === "all" ? (
        isLoading ? (
          <div className="-ml-2 flex gap-3 overflow-x-auto scrollbar-hide py-2 pl-2 pr-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="aspect-video w-66 shrink-0 animate-pulse rounded-xl bg-surface-2" />
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
                onToggle={() => toggleHighlight(season, ep.number)}
              />
            ))}
          </div>
        )
      ) : (
        /* ── Highlights: starred episodes across all seasons ── */
        highlights.length === 0 ? (
          <p className="py-6 text-center text-xs text-text-tertiary">
            Star an episode in <span className="text-text-secondary">All</span> to pin your best moments here.
          </p>
        ) : (
          <div ref={scrollRef} className="-ml-2 flex gap-3 overflow-x-auto scrollbar-hide py-2 pl-2 pr-2">
            {highlights.map((h) => (
              <StillCard
                key={h.id}
                still={h.still_path ? `https://image.tmdb.org/t/p/w300${h.still_path}` : null}
                line1={`S${h.season} · E${h.episode}`}
                line2={h.title ?? `Episode ${h.episode}`}
                highlighted
                onToggle={() => toggleHighlight(h.season, h.episode)}
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
