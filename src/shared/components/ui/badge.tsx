import { type ReactNode, type CSSProperties } from "react";
import { cn } from "@/shared/utils/utils";

/**
 * HEGON badge — ONE canonical chip across every module. The FORM is fixed (radius, padding,
 * weight) so a badge always reads as a HEGON badge; the COLOUR carries the meaning; the
 * MATERIAL is dictated by the surface underneath — never by taste.
 *
 *   tint    — colour-tinted fill + hairline (on a page surface: category, status)
 *   solid   — filled with the colour (a loud, singular label)
 *   outline — hairline only (quiet)
 *   flag    — ON ARTWORK, for a FLAG. Flat: a firm dark fill + a hairline.
 *   overlay — ON ARTWORK, for METADATA (genres). Barely-there.
 *
 * THE RULE ON ARTWORK — three natures of information, three treatments:
 *   · a FLAG is something added to the title (Trending, New, Priority, Status) → `flag`
 *   · METADATA is what the title IS (its genres)                               → `overlay`
 *   · a NUMBER (year, score) wears NO container at all — colour carries it.
 *
 * ── WHY `flag` IS FLAT, AND NOT GLASS ────────────────────────────────────────────────
 * It was glass, briefly, and the glass was wrong. Glass simulates a pane FLOATING over
 * content that MOVES — that's why iOS puts it on nav bars, where the blur recomputes as you
 * scroll and you watch it refract. Behind a badge on a poster, NOTHING ever moves. The blur
 * is computed once and never changes: a static image pretending to be a window. We paid the
 * whole cost (visual noise, a backdrop-filter per tile that mauls the GPU on a scrolling
 * grid) for none of the benefit. Neither Netflix nor Apple TV puts glass on a poster tile.
 * The physics is kept in globals.css for the Dashboard dock, where content really does move
 * behind it and the material EARNS itself.
 *
 * ── AND WHY ITS LABEL IS COLOURED AGAIN ──────────────────────────────────────────────
 * Briefly the label was white and the colour rode a dot. That was a rule borrowed from the
 * glass era — and it was a property of GLASS, not of badges: glass took its brightness from
 * the poster, so teal read on a dark one and died on a white one. A FLAT chip has its own
 * opaque fill, independent of the artwork, so colour is legible on anything again. The
 * constraint fell with the material, and colour says "Paused" better than a dot ever could.
 * (`dot` survives for the one case where the colour is a LIGHT, not a label: "Now".)
 *
 * WEIGHT follows the nature: a flag SHOUTS (semibold), metadata WHISPERS (medium).
 */
interface BadgeProps {
  /** Semantic colour — hex or CSS var. On a flag it paints the dot/icon, not the text. */
  color?: string;
  variant?: "tint" | "solid" | "outline" | "flag" | "overlay";
  /** sm = dense overlays (poster corners) · md = default · lg = hero chips */
  size?: "sm" | "md" | "lg";
  /** flag only — a status LIGHT (the "Now" pip). Not a colour carrier: the label is coloured. */
  dot?: boolean;
  uppercase?: boolean;
  className?: string;
  children: ReactNode;
}

const SIZES: Record<NonNullable<BadgeProps["size"]>, string> = {
  sm: "gap-1 px-1.5 py-0.5 text-caption",
  md: "gap-1 px-2 py-1 text-caption",
  lg: "gap-1.5 px-2.5 py-1 text-micro",
};

// A flag on artwork gets a little more room than a chip on a page: it has to survive being
// read at a glance, over an image, at poster scale.
/**
 * `overlay` is the GENRE variant — badge.tsx says so at the top — and a genre is a tag: a word you
 * put down, not a control. So it gets its own geometry rather than borrowing the others':
 *
 *  · a PILL, not a chip. Shape now carries meaning here — a chip acts or flags (Trending, New),
 *    a pill is a quiet label. It is also what genres looked like before the primitive existed,
 *    hand-rolled in three files; the geometry was right, only the duplication was wrong.
 *  · `text-micro` at EVERY size. The shared scale drops to `text-caption` below `lg`, which is the
 *    eyebrow role — 10px, semibold, 0.08em of tracking. That is built for a short shouted label
 *    ("TRENDING"); on "Animation" or "Drama" it reads spaced-out and stops looking like a word.
 *
 * Padding is the only thing that moves with size, because the only thing that changes between a
 * hero and a card is how much room the genre is allowed to take.
 */
const OVERLAY_SIZES: Record<NonNullable<BadgeProps["size"]>, string> = {
  sm: "gap-1 px-2 py-0.5 text-micro",
  md: "gap-1 px-2.5 py-0.5 text-micro",
  lg: "gap-1.5 px-3 py-1 text-micro",
};

// `sm` carries a FIXED height (h-5 = 20px), not padding-derived: it is THE on-artwork chip rung.
// Every flag on a poster/backdrop lands on the same 20px line, so a status, a "New", a countdown
// and the episode chip beside them all agree by construction — and, sharing one height, they snap
// to the pixel grid in unison when a card scales (no per-item drift). md/lg stay padding-sized.
const FLAG_SIZES: Record<NonNullable<BadgeProps["size"]>, string> = {
  sm: "h-5 gap-1.5 px-2 text-caption",
  md: "gap-1.5 px-2.5 py-1.5 text-caption",
  lg: "gap-2 px-3 py-1.5 text-micro",
};

const DOT_SIZE: Record<NonNullable<BadgeProps["size"]>, string> = {
  sm: "h-1 w-1",
  md: "h-1.5 w-1.5",
  lg: "h-1.5 w-1.5",
};

export function Badge({
  color = "var(--color-text-tertiary)",
  variant = "tint",
  size = "md",
  dot = false,
  uppercase = false,
  className,
  children,
}: BadgeProps) {
  const isFlag = variant === "flag";

  const style: CSSProperties =
    variant === "solid"
      ? {
          backgroundColor: color,
          color: "var(--color-surface-0)",
          boxShadow:
            "inset 0 1px 0 0 rgba(255,255,255,0.25), 0 1px 3px 0 rgba(0,0,0,0.35)",
        }
      : variant === "outline"
        ? { color, boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${color} 35%, transparent)` }
        : variant === "overlay"
          ? { color, backgroundColor: "rgba(255,255,255,0.10)" }
        : isFlag
          ? // COLOURED label — and this is a rule that was RIGHT to relax. The white-label rule
            // was never a property of badges; it was a property of GLASS, whose brightness came
            // from the poster underneath (teal read on a dark one and died on a white one). The
            // flag is now FLAT and opaque: its fill no longer depends on the artwork, so colour
            // is legible again — and colour carries the status far better than a dot ever did.
            // The constraint fell with the material. `--badge-mark` still drives the optional dot.
            ({ color, "--badge-mark": color } as CSSProperties)
          : {
              color,
              backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)`,
              boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${color} 22%, transparent)`,
            };

  return (
    <span
      className={cn(
        "inline-flex w-fit items-center leading-none",
        variant === "overlay" ? "font-medium" : "font-semibold",
        isFlag
          ? ["on-artwork rounded-chip [&_svg]:text-(--badge-mark)", FLAG_SIZES[size]]
          : variant === "overlay"
            ? ["rounded-full", OVERLAY_SIZES[size]]
            : ["rounded-chip", SIZES[size]],
        uppercase && "uppercase tracking-wider",
        className,
      )}
      style={style}
    >
      {isFlag && dot && (
        <span
          className={cn("shrink-0 rounded-full", DOT_SIZE[size])}
          style={{
            backgroundColor: "var(--badge-mark)",
            boxShadow: "0 0 6px var(--badge-mark)",
          }}
        />
      )}
      {children}
    </span>
  );
}
