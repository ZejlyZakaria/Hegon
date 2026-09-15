import { CheckCheck, Heart, Star } from "lucide-react";
import { cn } from "@/shared/utils/utils";
import { Badge } from "@/shared/components/ui/badge";

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

/**
 * THE PRIORITY IS A RIBBON TOO — the Top 10's sibling, owner-decided 2026-09-15. A ribbon hanging
 * from the top edge IS a bookmark; the lucide bookmark said the same thing in another shape. Same
 * hem, same shadow, the colour carries the level. Narrower than the Top 10 (14×22 against 22×30)
 * because it carries no text: an empty ribbon at the Top 10's size shouts as loud without saying
 * anything, and a priority is a note to yourself, a Top 10 is a rank. The two never meet on one
 * poster — a want-to-watch is not eligible for the Top 10.
 *
 * Two sizes, owner-tuned 2026-09-15: `card` hangs from the rail artwork (`left-2 top-0`, the
 * ribbon's slot); `row` stands in the watchlist panel's right column, a step smaller — the row
 * poster is 40 px wide, and a ribbon that fit it would be a coloured dot with the shape gone, so
 * it sits beside the row instead, at the row's scale.
 */
const PRIORITY_RIBBON = {
  card: { w: 14, h: 22 },
  row:  { w: 10, h: 16 },
} as const;
export function PriorityMark({ level, size = "card", className }: { level: "high" | "medium" | "low"; size?: keyof typeof PRIORITY_RIBBON; className?: string }) {
  const r = PRIORITY_RIBBON[size];
  return (
    <span
      aria-label={`${level} priority`}
      className={cn("block select-none", className)}
      style={{
        width: r.w,
        height: r.h,
        backgroundColor: PRIORITY[level],
        clipPath: "polygon(0 0, 100% 0, 100% 78%, 0 100%)",
        borderTopRightRadius: 3,
        filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.6))",
      }}
    />
  );
}

/**
 * A LIST's rank (a ranked custom list — "my best 2024"), NOT a Top 10: a teal bar and a number in the
 * left cluster. The Top 10 has its own object, the ribbon below; a list position is a smaller claim.
 */
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

/**
 * THE TOP 10 RIBBON — one object, three readings.
 *
 * A ribbon that HANGS from the top edge of the artwork, the way Netflix marks its Top 10: a
 * pentagon (a flag with a pointed tail), the module's own solid accent, white ink. With a `rank`
 * it prints the number — that is what the Top 10 rails and the fiche say, where the rank is the
 * fact. Without one it prints "TOP / 10" — membership, which is what a grid you sweep needs.
 *
 * Because it hangs from an edge it is the one mark that sits OUTSIDE the overlay clusters (the
 * priority bookmark is its sibling): flush to the top, 8 px from the left so it clears the corner
 * curve. Owner-specified 2026-09-14, replacing `RankMark` (a teal bar + a number).
 */
/**
 * Three sizes, one per surface — owner-tuned 2026-09-15:
 *   · library (grid tile)  → "TOP / 10", the reference size
 *   · carousel (rail card) → the rank, smaller than the tile's
 *   · hero (the fiche)     → the rank, a step up from the rail, never the poster's scale
 * Ink is semibold, not black: at 7-13 px a heavier weight fills the counters and reads as a smear.
 */
const RIBBON = {
  library:  { w: 26, h: 34, cap: 7,  num: 13 },
  carousel: { w: 22, h: 30, cap: 6,  num: 12 },
  hero:     { w: 30, h: 40, cap: 8,  num: 15 },
} as const;
export function TopTenRibbon({ rank, size = "library", className }: { rank?: number; size?: keyof typeof RIBBON; className?: string }) {
  const r = RIBBON[size];
  return (
    <span
      aria-label={rank ? `Ranked #${rank} in your Top 10` : "In your Top 10"}
      className={cn("flex flex-col items-center justify-start text-white select-none", className)}
      style={{
        width: r.w,
        height: r.h,
        // The VIVID accent — the tabs' and the ratings' teal — not the solid surface teal: a mark
        // on artwork has to carry its own light.
        backgroundColor: "var(--color-accent-watching-vivid)",
        // A folded hem: the bottom edge runs diagonally, lower on the left — the shape of the
        // reference, a flag whose corner has been turned, not a pennant.
        clipPath: "polygon(0 0, 100% 0, 100% 78%, 0 100%)",
        borderTopRightRadius: 3,
        filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.6))",
        paddingTop: rank ? Math.round(r.h * 0.22) : Math.round(r.h * 0.14),
      }}
    >
      {rank ? (
        <span className="font-semibold leading-none tabular-nums" style={{ fontSize: r.num }}>
          {String(rank).padStart(2, "0")}
        </span>
      ) : (
        <>
          <span className="font-semibold leading-none tracking-wide" style={{ fontSize: r.cap }}>TOP</span>
          <span className="font-semibold leading-none tabular-nums" style={{ fontSize: r.num, marginTop: 1 }}>10</span>
        </>
      )}
    </span>
  );
}

/**
 * THE AWARD TAG — a WON award, carrying the CEREMONY YEAR (the Museum reads by year). Horizontal,
 * hanging from the LEFT edge, the Top 10's folded hem turned on its side. Two tones, and the tone
 * is the one thing on the poster that says whether YOU have seen it (owner, 2026-09-15): metallic
 * gold when seen, dark grey when not — same shape, same place, so the eye compares colour only.
 * Both are tokens in globals.css (`--color-award`, `--color-award-dim`): reskin in one place.
 * Not amber: amber is already the watchlist's medium priority.
 *
 * Positions itself, CENTRED ON THE OVERLAY CLUSTER ROW (top-2, h-6) so it lines up with the heart
 * and the "…" menu opposite by construction; a parent only needs to be `relative`.
 *   · card = the rail card and the category-card mosaic · tile = the poster grid.
 */
const AWARD_TAG = {
  card: { h: 18, num: 9.5, padX: 6 },
  tile: { h: 18, num: 10, padX: 7 },
} as const;
const CLUSTER_TOP = 8, CLUSTER_H = 24;
export function AwardRibbon({ year, tone = "won", size = "card", className }: { year: number | string; tone?: "won" | "dim"; size?: keyof typeof AWARD_TAG; className?: string }) {
  const r = AWARD_TAG[size];
  return (
    <span
      aria-label={tone === "won" ? `Won in ${year} — seen` : `Won in ${year} — not seen yet`}
      className={cn("absolute left-0 z-10 flex items-center select-none", tone === "won" ? "text-white" : "text-white/80", className)}
      style={{
        top: CLUSTER_TOP + (CLUSTER_H - r.h) / 2,
        height: r.h,
        paddingLeft: r.padX,
        paddingRight: r.padX + 4,
        backgroundColor: tone === "won" ? "var(--color-award)" : "var(--color-award-dim)",
        // The hem: the right edge runs diagonally, further out at the top.
        clipPath: "polygon(0 0, 100% 0, calc(100% - 5px) 100%, 0 100%)",
        filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.6))",
      }}
    >
      <span className="font-semibold leading-none tabular-nums tracking-tight" style={{ fontSize: r.num }}>{year}</span>
    </span>
  );
}

/**
 * "Caught up" — ONE badge for ONE status, so it can never fragment into three again. It means the
 * same thing wherever it appears — "you've seen everything that's aired, you're waiting on more" —
 * whether that's a weekly show between episodes (In Progress) or a series between seasons (Last
 * Watched). The distinction is carried by WHICH RAIL the card sits in, never by the badge.
 *
 * `flag` because the primitive says so: a STATUS added to a title is a flag. Teal because it's YOUR
 * state (colour = source). `CheckCheck` = "everything seen", distinct from the generic confirm-check.
 * No forced height — the natural flag `sm` size, exactly like the ago/countdown flags it sits beside.
 */
export function CaughtUpBadge({ className }: { className?: string }) {
  return (
    <Badge variant="flag" size="sm" color={MINE} className={className}>
      <CheckCheck size={11} />
      Caught up
    </Badge>
  );
}
