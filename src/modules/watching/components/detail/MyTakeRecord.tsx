"use client";

import { useEffect, useRef } from "react";
import { Heart, Check, Play, Bookmark } from "lucide-react";
import { cn } from "@/shared/utils/utils";
import type { WatchingMedia } from "../../types";

// ── Rating Slider ──────────────────────────────────────────────────────────────

export function RatingSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const onChangeRef = useRef<(v: number) => void>(onChange);
  useEffect(() => { onChangeRef.current = onChange; });

  const setFromClientX = (clientX: number) => {
    if (!trackRef.current) return;
    const { left, width } = trackRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - left) / width));
    const v = Math.round(Math.max(1, Math.min(10, ratio * 9 + 1)) * 2) / 2;
    onChangeRef.current(v);
  };

  useEffect(() => {
    const onMove  = (e: MouseEvent) => { if (isDragging.current) setFromClientX(e.clientX); };
    const onTouch = (e: TouchEvent) => { if (isDragging.current && e.touches[0]) setFromClientX(e.touches[0].clientX); };
    const onUp = () => { isDragging.current = false; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onTouch);
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onTouch);
      window.removeEventListener("touchend", onUp);
    };
  }, []);

  const fillPercent = value > 0 ? ((value - 1) / 9) * 100 : 0;
  const label =
    value >= 9.5 ? "Masterpiece"
    : value >= 8   ? "Great"
    : value >= 7   ? "Good"
    : value >= 5   ? "Decent"
    : value >= 3   ? "Not for me"
    : value > 0    ? "Skip it"
    : null;

  return (
    <div className="select-none">
      {/* Tall, touch-friendly hit band — the whole strip (knob included) is grabbable
          and shows the pointer; touch-none lets a finger drag without scrolling. */}
      <div
        className="relative -my-2.5 cursor-pointer touch-none py-2.5"
        onMouseDown={(e) => { e.preventDefault(); isDragging.current = true; setFromClientX(e.clientX); }}
        onTouchStart={(e) => { isDragging.current = true; if (e.touches[0]) setFromClientX(e.touches[0].clientX); }}
      >
        <div ref={trackRef} className="relative h-0.75 w-full rounded-full bg-black/25">
          <div
            className="pointer-events-none absolute inset-y-0 left-0 w-full origin-left rounded-full bg-linear-to-r from-amber-500 to-amber-300"
            style={{ transform: `scaleX(${fillPercent / 100})`, transition: "transform 90ms cubic-bezier(0.22,1,0.36,1)" }}
          />
          {/* Knob always visible (even unrated, at 0) so a new title shows a grabbable handle */}
          <div
            className="pointer-events-none absolute top-1/2 -ml-2 h-4 w-4 -translate-y-1/2 rounded-full bg-white"
            style={{ left: `${fillPercent}%`, boxShadow: "0 1px 3px rgba(0,0,0,0.5), 0 0 0 0.5px rgba(0,0,0,0.15)" }}
          />
        </div>
      </div>
      {/* Scale — each number is centered exactly under its knob position, so the knob
          lines up perfectly with the number it represents. */}
      <div className="relative mt-3 h-3.5">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
          <span
            key={n}
            className="absolute -translate-x-1/2 text-[10px] tabular-nums text-white/40"
            style={{ left: `${((n - 1) / 9) * 100}%` }}
          >
            {n}
          </span>
        ))}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
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
  isSeries?: boolean;
  onMarkWatched?: () => void;
  onStartWatching?: () => void;
  isUpdating?: boolean;
}

export function MyTakeRecord({
  notes,
  onNotesChange,
  starRating,
  onStarRatingChange,
  media,
  favorite,
  onFavoriteToggle,
  isSeries,
  onMarkWatched,
  onStartWatching,
  isUpdating,
}: Props) {
  const isUnwatched = !!(media.is_reference || (media.want_to_watch && !media.watched && !media.in_progress));

  return (
    <section className="flex flex-col gap-4 sm:flex-row sm:items-stretch">

      {/* My Take */}
      <div className="flex flex-3 flex-col">
        <h2 className="mb-3 text-title text-text-primary">My Take</h2>
        <div className="surface-card relative flex flex-1 flex-col overflow-hidden rounded-2xl">
          <textarea
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            placeholder={isUnwatched ? "Why do you want to watch this? Any notes…" : "What did you think? Was it worth your time?"}
            className="min-h-32 flex-1 resize-none bg-transparent p-4 text-sm leading-relaxed text-text-primary placeholder:text-text-tertiary/60 focus:outline-none"
          />
          <div className="px-4 py-1.5 text-right">
            <span className="text-[10px] tabular-nums text-text-tertiary">
              {notes.trim() ? notes.trim().split(/\s+/).length : 0} words
            </span>
          </div>
        </div>
      </div>

      {/* My Record */}
      <div className="flex flex-2 min-w-0 flex-col">
        <h2 className="mb-3 text-title text-text-primary">My Record</h2>
        <div
          className="flex flex-1 flex-col overflow-hidden rounded-2xl bg-accent-watching"
          style={{ boxShadow: "inset 0 1px 0 0 rgba(255,255,255,0.10), inset 0 0 0 1px rgba(255,255,255,0.06), 0 2px 6px -2px rgba(0,0,0,0.5), 0 18px 44px -18px rgba(0,0,0,0.6)" }}
        >

          {isUnwatched ? (
            /* ── Unwatched state ── */
            <div className="flex flex-1 flex-col justify-between gap-4 p-4">
              <div>
                <p className="mb-2 text-caption uppercase text-white/45">Status</p>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white/80">
                  <Bookmark size={10} />
                  {media.is_reference ? "Unwatched" : "Want to Watch"}
                </span>
              </div>

              <div className="h-px bg-white/15" />

              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={onMarkWatched}
                  disabled={isUpdating}
                  className="flex items-center justify-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-accent-watching transition-[transform,opacity] duration-150 ease-out hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
                >
                  <Check size={14} />
                  Mark as watched
                </button>
                {isSeries && (
                  <button
                    type="button"
                    onClick={onStartWatching}
                    disabled={isUpdating}
                    className="flex items-center justify-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-medium text-white transition-[transform,background-color] duration-150 ease-out hover:bg-white/15 active:scale-[0.98] disabled:opacity-50"
                  >
                    <Play size={14} className="fill-current" />
                    Start watching
                  </button>
                )}
              </div>
            </div>
          ) : (
            /* ── Watched / In Progress / Dropped state ── */
            <div className="flex flex-1 flex-col justify-between gap-4 p-4">

              <div>
                <p className="mb-2 text-caption uppercase text-white/45">Status</p>
                <div className="flex flex-wrap gap-1.5">
                  {media.watched && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/12 px-2.5 py-1 text-[11px] font-medium text-white">
                      <Check size={10} /> Watched
                    </span>
                  )}
                  {media.in_progress && !media.watched && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/12 px-2.5 py-1 text-[11px] font-medium text-white">
                      <Play size={10} className="fill-current" /> In Progress
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={onFavoriteToggle}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors active:scale-[0.97]",
                      favorite
                        ? "bg-white/12 text-white"
                        : "bg-white/5 text-white/55 hover:text-white/80",
                    )}
                  >
                    <Heart size={10} className={cn(favorite && "fill-current")} />
                    {favorite ? "Favorited" : "Favorite"}
                  </button>
                </div>
              </div>

              <div className="h-px bg-white/15" />

              <div>
                <p className="mb-3 text-caption uppercase text-white/45">My Rating</p>
                <RatingSlider value={starRating} onChange={onStarRatingChange} />
              </div>

            </div>
          )}

        </div>
      </div>

    </section>
  );
}
