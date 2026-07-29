import { Bookmark, Heart, Star } from "lucide-react";
import { cn } from "@/shared/utils/utils";

/**
 * THE GRAMMAR OF WATCHING'S MARKS. Every star, heart and rank chip in the module comes from
 * here, so a colour always means the same thing:
 *
 *   ★ gold  = the WORLD's score (TMDB / IMDb) — a number you didn't write
 *   ★ teal  = YOUR score — the accent is "you", everywhere in the module
 *   ♥ red   = affection (favorite). The one non-system colour, and it earns it: it's an
 *             emotional axis, not a source. So it's the SAME red everywhere — including
 *             the anime themes, which used to be teal for no reason.
 *
 * Before this, a gold star meant TMDB in one place and your own rating in another. That's
 * not a style problem — it's a badge that lies.
 */
export const GOLD = "var(--color-gold)";
export const MINE = "var(--color-accent-watching-vivid)";
export const LOVE = "#f43f5e";   // rose-500 — affection, and only affection

/**
 * THE OVERLAY GRAMMAR. Exactly two clusters may sit on a piece of artwork:
 *   left  = IDENTITY — what this title IS (rank, priority)
 *   right = ACTIONS  — what you can do to it (favorite, menu)
 * Same inset, same 24px item height, same gap. They then align BY CONSTRUCTION — which
 * three separate `top-2` / `top-3` / `right-10` guesses never could.
 *
 * THE INSET IS 8px (top-2 / left-2 / right-2), and it is 8px on purpose: a poster is
 * `rounded-tile` (8px), so an 8px inset nests the mark exactly inside the corner curve —
 * the safe area — instead of floating a couple of pixels past it. This is THE inset for
 * anything on artwork across the whole module; the only surfaces that opt out are the
 * full-bleed heroes (MediaHero / PersonHero), whose scale earns a larger margin.
 */
export const OVERLAY_CLUSTER = "absolute top-2 z-10 flex h-6 items-center gap-1.5";

/**
 * A round overlay control (the favorite heart, the `…` menu). FLAT — it was frosted glass,
 * and a frosted `…` that opens a plain dropdown promises a physical object and hands you a
 * list. The material was making a promise the interaction never kept.
 *
 * `rounded-full` is right here because this shape IS round. Text is a different matter, and it
 * splits in two: a badge that ACTS or FLAGS (Trending, New, a status) is a `rounded-chip`, while a
 * genre — a word you put down, nothing more — is a pill. See `OVERLAY_SIZES` in badge.tsx.
 */
export const OVERLAY_CIRCLE = "on-artwork flex h-6 w-6 items-center justify-center rounded-full";

type Source = "world" | "mine";

/**
 * A score. NO container — a number doesn't need a box, it needs a colour. Boxing it made it
 * compete with the flags (New, Trending), which are the only things on a card that should
 * shout. `source` picks the colour; that's the whole mark.
 */
export function ScoreMark({
  value,
  source = "world",
  size = "sm",
  onArtwork = false,
  className,
}: {
  value: number | string;
  source?: Source;
  size?: "sm" | "md";
  /** Sitting on bare artwork (no scrim under it) — buy legibility with a shadow, not a box. */
  onArtwork?: boolean;
  className?: string;
}) {
  const color = source === "mine" ? MINE : GOLD;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-semibold tabular-nums",
        size === "sm" ? "text-micro" : "text-xs",
        className,
      )}
      style={{ color, textShadow: onArtwork ? "0 1px 4px rgba(0,0,0,0.9)" : undefined }}
    >
      <Star size={size === "sm" ? 10 : 11} style={{ color, fill: color }} />
      {value}
    </span>
  );
}

/** The favorite mark. Not a button — wrap it in one when it's clickable. */
export function LoveMark({ filled = true, size = 13 }: { filled?: boolean; size?: number }) {
  return (
    <Heart
      size={size}
      style={filled ? { color: LOVE, fill: LOVE } : undefined}
      className={filled ? undefined : "text-white/70"}
    />
  );
}

/**
 * Top 10 rank — an EDITORIAL lockup, not a badge.
 *
 * Two dead ends before this one: a grey disc (said nothing, read as a bug at poster scale)
 * and a fat teal numeral (loud, and it fought the artwork it was sitting on). The problem
 * with both is the same: they treated the rank as a THING to put on the poster. It isn't.
 * It's a masthead — the number is small, set tight, in white; the ACCENT is a hairline rule
 * standing beside it, exactly the same gesture as a HEGON section label. Restraint is what
 * reads as premium: the eye finds it because it's the only straight line on a photograph,
 * not because it shouts.
 *
 * Zero-padded ("01", not "1") so #1 and #10 have identical width — a rail of ranked posters
 * lines up down its left edge instead of wobbling.
 *
 * Sized to the overlay cluster (h-6) so it aligns with everything beside it.
 */
/**
 * PRIORITY — a bookmark, coloured by urgency.
 *
 * This is the ONE place the source rule bends, and it bends for a reason that outranks it: the
 * colour language for priority is already taught at the INPUT. The add modal offers red / amber /
 * grey dots when you pick high, medium or low. A card that answered in teal — or in words, or with
 * nothing — would make the picker teach a vocabulary the rest of the app never speaks.
 *
 * So the three levels are all marked, and the colour IS the mark. That is also why a graded mark
 * survives being on every poster where a uniform one wouldn't: you don't scan for "is there a
 * bookmark", you scan for "how red is it". Grey says low without raising its voice.
 *
 * The values are Tailwind's own tokens, the same ones the modal's classes resolve to, so the two
 * ends of this language cannot drift apart into two palettes that a comment claims are one.
 * (`LOVE` is rose-500 and the heart is a heart: different hue, different shape, no collision.)
 */
export const PRIORITY: Record<"high" | "medium" | "low", string> = {
  high: "var(--color-red-400)",
  medium: "var(--color-amber-400)",
  low: "var(--color-zinc-500)",
};

export function PriorityMark({ level, size = 17 }: { level: "high" | "medium" | "low"; size?: number }) {
  const color = PRIORITY[level];
  return (
    <Bookmark
      size={size}
      aria-label={`${level} priority`}
      style={{ color, fill: color, filter: "drop-shadow(0 1px 4px rgba(0,0,0,0.8))" }}
    />
  );
}

export function RankMark({ rank, className }: { rank: number; className?: string }) {
  return (
    <span className={cn("flex h-6 items-center gap-1.5", className)}>
      <span
        className="h-4.5 w-[2.5px] rounded-full"
        style={{ backgroundColor: MINE, boxShadow: `0 0 8px ${MINE}` }}
      />
      <span
        className="text-sm font-bold leading-none tabular-nums tracking-tight text-white"
        style={{ textShadow: "0 1px 4px rgba(0,0,0,0.8)" }}
      >
        {String(rank).padStart(2, "0")}
      </span>
    </span>
  );
}
