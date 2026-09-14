"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@/shared/utils/utils";

/**
 * TEN STARS, HALF STEPS — the same /10 scale as `RatingPicker`, in a row instead of a ceremony.
 *
 * ONE scale, TWO presentations, chosen by rank. The bar with its words (Skip it → Masterpiece) is
 * the verdict on a TITLE, given once, in My Take. A season is a verdict of second rank, given in a
 * panel, possibly ten times for one show — the same ceremony ten times over is noise. Stars say the
 * number in a glance and take it in a tap: the left half of a star is n − 0.5, the right half is n.
 *
 * TEAL, not gold. Colour is the SOURCE (Marks.tsx): gold is the world's and the best-episode star;
 * teal is yours. A rating is yours.
 *
 * Tapping the star that already holds the value clears it — the one gesture a rating control
 * needs beyond setting, and no separate "clear" link.
 */
const TEAL = "var(--color-accent-watching-vivid)";

export function StarRating({
  value,
  onChange,
  className,
  size = "md",
  onArtwork = false,
}: {
  /** 0 = unrated. */
  value: number;
  onChange: (v: number | null) => void;
  className?: string;
  /** sm = 14 px stars in a 16 px cell (a narrow column) · md = 17 px in 20 px. */
  size?: "sm" | "md";
  /** Sitting on artwork (the season card): white ink instead of the page's text tokens. */
  onArtwork?: boolean;
}) {
  const px = size === "sm" ? 14 : 17;
  // What the pointer is over — previewed on a hover device, never written.
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? value;

  const pick = (n: number, e: React.MouseEvent<HTMLButtonElement>) => {
    const { left, width } = e.currentTarget.getBoundingClientRect();
    return e.clientX - left < width / 2 ? n - 0.5 : n;
  };

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div
        className="flex items-center"
        role="radiogroup"
        aria-label="Rating out of ten"
        onMouseLeave={() => setHover(null)}
      >
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
          const fill = shown >= n ? 100 : shown >= n - 0.5 ? 50 : 0;
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={value === n || value === n - 0.5}
              aria-label={`${n} out of 10`}
              className={cn("relative flex h-7 items-center justify-center", size === "sm" ? "w-4" : "w-5")}
              onMouseMove={(e) => setHover(pick(n, e))}
              onClick={(e) => {
                const v = pick(n, e);
                onChange(v === value ? null : v);
              }}
            >
              <Star size={px} className={onArtwork ? "text-white/35" : "text-text-tertiary/50"} />
              {fill > 0 && (
                <span
                  className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden"
                  style={{ clipPath: `inset(0 ${100 - fill}% 0 0)` }}
                >
                  <Star size={px} style={{ color: TEAL, fill: TEAL }} />
                </span>
              )}
            </button>
          );
        })}
      </div>
      <span
        className={cn(
          "w-7 text-right font-semibold tabular-nums",
          size === "sm" ? "text-xs" : "text-sm",
          shown > 0 ? (onArtwork ? "text-white" : "text-text-primary") : (onArtwork ? "text-white/50" : "text-text-tertiary"),
        )}
      >
        {shown > 0 ? shown : "—"}
      </span>
    </div>
  );
}
