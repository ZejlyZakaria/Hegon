"use client";

import { useEffect, useRef } from "react";
import { Heart, Check, Play, Bookmark } from "lucide-react";
import { cn } from "@/shared/utils/utils";
import type { WatchingMedia } from "../../types";

// ── Rating Slider ──────────────────────────────────────────────────────────────

function RatingSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const onChangeRef = useRef<(v: number) => void>(onChange);
  useEffect(() => { onChangeRef.current = onChange; });

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDragging.current || !trackRef.current) return;
      const { left, width } = trackRef.current.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - left) / width));
      const v = Math.round(Math.max(0, Math.min(10, ratio * 10)) * 2) / 2;
      onChangeRef.current(v);
    };
    const onUp = () => { isDragging.current = false; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  const fillPercent = value > 0 ? (value / 10) * 100 : 0;
  const label =
    value >= 9 ? "Masterpiece"
    : value >= 7 ? "Great"
    : value >= 5 ? "Good"
    : value >= 3 ? "Mixed"
    : value > 0 ? "Poor"
    : null;

  return (
    <div className="select-none">
      <div
        ref={trackRef}
        className="relative h-0.75 w-full cursor-pointer rounded-full bg-black/25"
        onMouseDown={(e) => {
          e.preventDefault();
          isDragging.current = true;
          if (!trackRef.current) return;
          const { left, width } = trackRef.current.getBoundingClientRect();
          const ratio = Math.max(0, Math.min(1, (e.clientX - left) / width));
          const v = Math.round(Math.max(0, Math.min(10, ratio * 10)) * 2) / 2;
          onChange(v);
        }}
      >
        {value > 0 && (
          <>
            <div
              className="pointer-events-none absolute left-0 top-0 h-full rounded-full bg-linear-to-r from-amber-600 to-amber-400"
              style={{ width: `${fillPercent}%`, transition: "width 60ms ease-out" }}
            />
            <div
              className="pointer-events-none absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full bg-amber-400 shadow-md shadow-amber-400/40"
              style={{ left: `calc(${fillPercent}% - 7px)`, transition: "left 60ms ease-out" }}
            />
          </>
        )}
      </div>
      <div className="mt-2.5 flex justify-between">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
          <span key={n} className="text-[10px] tabular-nums text-white/40">{n}</span>
        ))}
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        {value > 0 ? (
          <>
            <span className="text-3xl font-bold tabular-nums text-white">{value}</span>
            <span className="text-sm text-white/60">/ 10</span>
            {label && <span className="text-sm font-medium text-amber-400">{label}</span>}
          </>
        ) : (
          <span className="text-xs text-white/50">Not rated yet</span>
        )}
      </div>
    </div>
  );
}

// ── MyTakeRecord ───────────────────────────────────────────────────────────────

interface Props {
  notes: string;
  onNotesChange: (v: string) => void;
  starRating: number; // 0–10
  onStarRatingChange: (v: number) => void;
  media: WatchingMedia;
  favorite: boolean;
  onFavoriteToggle: () => void;
}

export function MyTakeRecord({
  notes,
  onNotesChange,
  starRating,
  onStarRatingChange,
  media,
  favorite,
  onFavoriteToggle,
}: Props) {
  const isWantToWatch = media.want_to_watch && !media.watched && !media.in_progress;

  return (
    <section className="flex flex-col gap-5 sm:flex-row sm:items-stretch">

      {/* My Take (~60%, full width if no My Record) */}
      <div className={cn("flex flex-col", isWantToWatch ? "flex-1" : "flex-3")}>
        <h2 className="mb-3 text-sm font-semibold text-text-primary">My Take</h2>
        <div className="relative flex flex-1 flex-col overflow-hidden rounded-xl border border-border-subtle bg-surface-2">
          <textarea
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            placeholder={isWantToWatch ? "Why do you want to watch this? Any notes…" : "What did you think? Was it worth your time?"}
            className="flex-1 resize-none bg-transparent p-4 text-sm leading-relaxed text-text-primary placeholder:text-text-tertiary/60 focus:outline-none"
          />
          {/* Word count */}
          <div className="px-4 py-1.5 text-right">
            <span className="text-[10px] tabular-nums text-text-tertiary">
              {notes.trim() ? notes.trim().split(/\s+/).length : 0} words
            </span>
          </div>
        </div>
      </div>

      {/* My Record (~40%) — hidden for Want to Watch */}
      {!isWantToWatch && <div className="flex flex-2 min-w-0 flex-col">
        <h2 className="mb-3 text-sm font-semibold text-text-primary">My Record</h2>
        <div className="flex flex-1 flex-col overflow-hidden rounded-xl bg-accent-watching">
          <div className="flex flex-1 flex-col justify-between gap-4 p-4">

            {/* Status */}
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-white/60">Status</p>
              <div className="flex flex-wrap gap-1.5">
                {media.watched && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white/90">
                    <Check size={10} /> Watched
                  </span>
                )}
                {media.in_progress && !media.watched && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white/90">
                    <Play size={10} className="fill-current" /> In Progress
                  </span>
                )}
                {media.want_to_watch && !media.watched && !media.in_progress && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white/90">
                    <Bookmark size={10} className="fill-current" /> Want to Watch
                  </span>
                )}
                <button
                  type="button"
                  onClick={onFavoriteToggle}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border bg-transparent px-2.5 py-1 text-[11px] font-medium transition-colors",
                    favorite
                      ? "border-white/30 bg-white/10 text-white/90"
                      : "border-white/20 text-white/60 hover:text-white/80",
                  )}
                >
                  <Heart size={10} className={cn(favorite && "fill-current")} />
                  {favorite ? "Favorited" : "Favorite"}
                </button>
              </div>
            </div>

            <div className="h-px bg-white/20" />

            {/* My Rating */}
            <div>
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-white/60">My Rating</p>
              <RatingSlider
                value={starRating}
                onChange={onStarRatingChange}
              />
            </div>

          </div>
        </div>
      </div>}

    </section>
  );
}
