"use client";

import { useRef } from "react";
import { cn } from "@/shared/utils/utils";

export function ratingLabel(value: number): string | null {
  return value >= 9.5 ? "Masterpiece"
    : value >= 8   ? "Great"
    : value >= 7   ? "Good"
    : value >= 5   ? "Decent"
    : value >= 3   ? "Not for me"
    : value > 0    ? "Skip it"
    : null;
}

// One anchor per band of `ratingLabel` — the scale now says every word it can actually
// award. `wide` ones are dropped on a phone, where six labels collide into mush.
const ANCHORS = [
  { at: 1, label: "Skip it", wide: false },
  { at: 3, label: "Not for me", wide: true },
  { at: 5, label: "Decent", wide: false },
  { at: 7, label: "Good", wide: true },
  { at: 8, label: "Great", wide: true },
  // 9.5, not 10 — that's where ratingLabel() actually starts calling it a masterpiece.
  // An anchor has to sit on its real threshold or the scale is lying by half a point.
  { at: 9.5, label: "Masterpiece", wide: false },
];

/**
 * The rating bar. It IS a slider — but rebuilt on pointer events with pointer capture, not
 * on window mouse/touch listeners over a 3px track. That's what broke it on a phone: the
 * finger covered the line it was aiming at, and the first vertical wobble handed the gesture
 * to the scroller. Here the grab band is ~44px tall, the pointer is captured for the whole
 * drag, and a plain tap anywhere on the band sets the value. Snaps to 0.5.
 */
export function RatingPicker({
  value,
  onChange,
  className,
  showValue = true,
}: {
  value: number;                 // 0 = unrated
  onChange: (v: number) => void;
  className?: string;
  /** Off in My Take, which prints the number itself next to the percentile. */
  showValue?: boolean;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const rated = value > 0;
  const pct = rated ? ((value - 1) / 9) * 100 : 0;

  const setFromX = (clientX: number) => {
    const el = trackRef.current;
    if (!el) return;
    const { left, width } = el.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - left) / width));
    onChange(Math.round(Math.max(1, Math.min(10, ratio * 9 + 1)) * 2) / 2);
  };

  return (
    <div className={cn("select-none", className)}>
      {showValue && (
        <div className="flex items-baseline gap-2">
          {rated ? (
            <>
              <span className="text-3xl font-bold leading-none tabular-nums text-text-primary">{value}</span>
              <span className="text-sm text-text-tertiary">/ 10</span>
              <span className="text-sm font-semibold text-amber-400">{ratingLabel(value)}</span>
            </>
          ) : (
            <span className="text-body text-text-secondary">Tap the bar to rate</span>
          )}
        </div>
      )}

      {/* Grab band — the whole strip is the target, not the 10px bar inside it. */}
      <div
        className="relative cursor-pointer touch-none py-3"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          setFromX(e.clientX);
        }}
        onPointerMove={(e) => {
          // Capture means we keep receiving moves even off the element — no lost finger.
          if (e.currentTarget.hasPointerCapture(e.pointerId)) setFromX(e.clientX);
        }}
        onPointerUp={(e) => e.currentTarget.releasePointerCapture(e.pointerId)}
      >
        <div ref={trackRef} className="relative h-2.5 w-full rounded-full bg-surface-2">
          {rated && (
            <>
              <div
                className="pointer-events-none absolute inset-y-0 left-0 rounded-full bg-linear-to-r from-amber-500 to-amber-300"
                style={{ width: `${pct}%`, transition: "width 90ms cubic-bezier(0.22,1,0.36,1)" }}
              />
              <div
                className="pointer-events-none absolute top-1/2 -ml-2.5 h-5 w-5 -translate-y-1/2 rounded-full bg-white"
                style={{
                  left: `${pct}%`,
                  boxShadow: "0 1px 4px rgba(0,0,0,0.55), 0 0 0 0.5px rgba(0,0,0,0.2)",
                  transition: "left 90ms cubic-bezier(0.22,1,0.36,1)",
                }}
              />
            </>
          )}
        </div>

        {/* Ten ticks, one per point, hanging off the bar — the scale you can count. */}
        <div className="pointer-events-none relative mt-1 h-1.5">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
            <span
              key={n}
              className={cn(
                "absolute top-0 h-1.5 w-px -translate-x-1/2 rounded-full transition-colors",
                rated && value >= n ? "bg-amber-300/70" : "bg-white/15",
              )}
              style={{ left: `${((n - 1) / 9) * 100}%` }}
            />
          ))}
        </div>
      </div>

      {/* Anchor words — a scale needs meaning, not just numbers. The NUMBER is centred on
          its tick (that's the whole point of a tick); only the word, which is far wider,
          gets pulled inward at the two ends so it doesn't fall off the bar. */}
      <div className="relative mt-1 h-7">
        {ANCHORS.map((a, i) => {
          const pos = `${((a.at - 1) / 9) * 100}%`;
          const first = i === 0;
          const last = i === ANCHORS.length - 1;
          const tone = rated && value >= a.at ? "text-text-secondary" : "text-text-tertiary/70";
          return (
            <span key={a.at} className={cn(a.wide && "hidden sm:block")}>
              <span
                className={cn(
                  "absolute top-0 text-[10px] font-semibold leading-tight tabular-nums",
                  first ? "" : "-translate-x-1/2",
                  tone,
                )}
                style={{ left: pos }}
              >
                {a.at}
              </span>
              <span
                className={cn(
                  "absolute top-3.5 whitespace-nowrap text-[10px] leading-tight",
                  // The word is far wider than the tick: centred everywhere, except the
                  // last one on a phone, where centring would push it off the bar.
                  first ? "" : last ? "-translate-x-full sm:-translate-x-1/2" : "-translate-x-1/2",
                  tone,
                )}
                style={{ left: pos }}
              >
                {a.label}
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
