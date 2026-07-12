"use client";

import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/shared/components/ui/dialog";
import { useImdbId } from "../../hooks/useImdbId";
import { useEpisodeRatings } from "../../hooks/useEpisodeRatings";
import type { WatchingMedia } from "../../types";

const LEGEND = [
  { label: "Awesome", color: "#15803d" },
  { label: "Great", color: "#22c55e" },
  { label: "Good", color: "#eab308" },
  { label: "Regular", color: "#f97316" },
  { label: "Bad", color: "#ef4444" },
];

function cellColor(r: number): string {
  if (r >= 8.5) return "#15803d";
  if (r >= 8) return "#22c55e";
  if (r >= 7) return "#eab308";
  if (r >= 6) return "#f97316";
  return "#ef4444";
}
// Dark text on the lighter mid-tones, white on the darkest green / red.
function textColor(r: number): string {
  return r >= 8.5 || r < 6 ? "#ffffff" : "#0a0a0a";
}

interface Props {
  open: boolean;
  onClose: () => void;
  media: WatchingMedia;
}

export function EpisodeHeatmapModal({ open, onClose, media }: Props) {
  const { data: imdbId } = useImdbId(media.tmdb_id ?? 0, media.type, open && !!media.tmdb_id);
  const { data, isLoading } = useEpisodeRatings(imdbId, open && !!imdbId);

  const ratings = data?.ratings ?? {};
  const seasonCount = data?.seasonEpisodes.length ?? 0;
  // Rows go up to the highest episode that actually has a rating — no empty tail.
  const ratedEpNums = Object.values(ratings).flatMap((s) => Object.keys(s).map(Number));
  const maxEp = ratedEpNums.length ? Math.max(...ratedEpNums) : 0;
  const seasons = Array.from({ length: seasonCount }, (_, i) => i + 1);
  const episodes = Array.from({ length: maxEp }, (_, i) => i + 1);

  const empty = !isLoading && (seasonCount === 0 || maxEp === 0);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-3xl border-border-strong bg-surface-1 sm:max-w-3xl">
        <DialogTitle className="text-base font-semibold text-text-primary">Episode ratings</DialogTitle>
        <DialogDescription className="sr-only">IMDb rating of every episode by season.</DialogDescription>

        {/* Legend */}
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {LEGEND.map((l) => (
            <span key={l.label} className="flex items-center gap-1.5 text-micro text-text-tertiary">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: l.color }} />
              {l.label}
            </span>
          ))}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={20} className="animate-spin text-text-tertiary" />
          </div>
        ) : empty ? (
          <p className="py-16 text-center text-sm text-text-tertiary">No episode ratings found.</p>
        ) : (
          <div className="max-h-[60vh] overflow-auto">
            <div className="flex gap-1">
              {/* Episode labels column */}
              <div className="sticky left-0 z-10 flex shrink-0 flex-col gap-1 bg-surface-1 pr-1">
                <div className="h-7" />
                {episodes.map((e) => (
                  <div key={e} className="flex h-9 items-center text-micro font-medium text-text-tertiary">
                    E{e}
                  </div>
                ))}
              </div>

              {/* Season columns */}
              {seasons.map((s) => (
                <div key={s} className="flex min-w-12 flex-1 flex-col gap-1">
                  <div className="flex h-7 items-center justify-center text-xs font-semibold text-text-secondary">
                    S{s}
                  </div>
                  {episodes.map((e) => {
                    const r = ratings[s]?.[e];
                    // No rating → blank cell (keeps grid alignment, no "–" clutter).
                    if (r == null) return <div key={e} className="h-9" />;
                    return (
                      <div
                        key={e}
                        title={`S${s}E${e} · ${r.toFixed(1)}`}
                        className="flex h-9 items-center justify-center rounded-chip text-xs font-bold tabular-nums"
                        style={{ background: cellColor(r), color: textColor(r) }}
                      >
                        {r.toFixed(1)}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-micro text-text-tertiary/50">IMDb episode ratings via OMDb</p>
      </DialogContent>
    </Dialog>
  );
}
