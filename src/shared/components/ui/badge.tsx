import { type ReactNode, type CSSProperties } from "react";
import { cn } from "@/shared/utils/utils";

/**
 * HEGON badge — ONE canonical chip across every module. The FORM is fixed (radius, padding,
 * weight) so a badge always reads as a HEGON badge; the COLOUR carries the meaning; the
 * MATERIAL is dictated by the surface underneath — never by taste.
 *
 *   tint    — colour-tinted fill + hairline (on a page surface: category, status)
 *   solid   — filled with the colour (a loud, singular label: "Trending")
 *   outline — hairline only (quiet)
 *   glass   — ON ARTWORK, and ONLY FOR A FLAG.
 *   overlay — ON ARTWORK, for METADATA (genres). Barely-there, no blur.
 *
 * THE RULE ON ARTWORK — three natures of information, three treatments:
 *   · a FLAG is something added to the title (Trending, New, Priority, Status) → `glass`
 *   · METADATA is what the title IS (its genres)                              → `overlay`
 *   · a NUMBER (year, score) wears NO container at all — colour carries it.
 * Glass everywhere = glass signals nothing. It's the loudest material, so it's the rarest.
 *
 * ── WHY A GLASS BADGE HAS A WHITE LABEL ──────────────────────────────────────────────
 * Because real glass can't carry coloured text. Glass has to SHOW what's under it (that's
 * the whole point of the material), which means its own brightness is whatever the poster
 * gives it. Teal text survives a dark backdrop and dies on a white one. Every previous
 * attempt at this chip solved that by darkening the fill until the text worked — and killed
 * the glass in the process. That's backwards: you don't dim the window to read the sticker.
 *
 * So the label goes WHITE (which reads on anything, with a shadow), and the colour moves to
 * a DOT or the icon beside it. iOS does exactly this, and we'd already stumbled onto it once
 * — the "Now" badge on Watch History has always been a teal dot + a white word. It was the
 * only glass chip in the app that looked right. Now it's the rule.
 *
 * WEIGHT follows the nature: a flag SHOUTS (semibold), metadata WHISPERS (medium).
 */
interface BadgeProps {
  /** Semantic colour — hex or CSS var. On glass it paints the dot/icon, not the text. */
  color?: string;
  variant?: "tint" | "solid" | "outline" | "glass" | "overlay";
  /** sm = dense overlays (poster corners) · md = default · lg = hero chips */
  size?: "sm" | "md" | "lg";
  /** glass only — a coloured dot before the label, for flags with no icon of their own. */
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

// Glass is a THICKER chip: a pane of glass has edges, and edges need room. A tight chip
// reads as a label with a blur behind it; this reads as an object lying on the poster.
const GLASS_SIZES: Record<NonNullable<BadgeProps["size"]>, string> = {
  sm: "gap-1.5 px-2 py-1 text-caption",
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
  const isGlass = variant === "glass";

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
        : isGlass
          ? // White label; `color` is handed to the dot and to any icon inside, via a var.
            ({ color: "#fff", "--badge-mark": color } as CSSProperties)
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
        // Radius stays `rounded-chip` — the locked rule (a pill is for shapes that ARE round).
        // The iOS reference is a capsule, and that's a real question, but it's YOURS to answer:
        // changing the radius rule quietly would break it everywhere else.
        isGlass
          ? ["glass-thin rounded-chip [&_svg]:text-(--badge-mark)", GLASS_SIZES[size]]
          : ["rounded-chip", SIZES[size]],
        uppercase && "uppercase tracking-wider",
        className,
      )}
      style={style}
    >
      {isGlass && dot && (
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
