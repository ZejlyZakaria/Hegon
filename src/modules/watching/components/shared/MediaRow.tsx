import Image from "next/image";
import Link from "next/link";
import { Play } from "lucide-react";
import { cn } from "@/shared/utils/utils";
import { tmdbImageFor } from "../../lib/tmdb-image";

/**
 * A COMPACT REFERENCE TO A TITLE — poster, name, one line of context, whatever the surface needs on
 * the right. THE one poster-xs row: Top Picks, the Hours breakdown panel, the person timeline and
 * insights, and both search lists (global + add modal) were each drawing their own version — same
 * intent, six slightly different gaps, radii, and posters (the global search even carried a comment
 * noting its `w-8` disagreed with the add modal's `w-9`). So the poster, its corner, the spacing,
 * the hover, and the title's hover colour live HERE, once. Change the look in one place.
 *
 * Not a card. The carousel tile and the library cell are for BROWSING — marks, a rank, a status,
 * hover actions, a scale on hover. This is the other shape: a reference you read and click through,
 * never act on in place.
 *
 * ── THE POSTER CORNER IS `rounded-thumb` (4px) ────────────────────────────────────────────────
 * The xs rung (40px) took `rounded-chip` (6px); Books reached 4px independently, and the ladder in
 * globals.css flagged it to reconcile. This is that: at 40px a 6px corner reads button-ish, 4px
 * reads like a printed photo. It's a TOKEN (`--radius-thumb`), not a hardcoded value — change that
 * one line to reskin every xs poster, like every other role in the ladder.
 */
export function MediaRow({
  posterUrl,
  title,
  meta,
  eyebrow,
  right,
  below,
  href,
  onClick,
  selected,
  disabled,
  className,
}: {
  posterUrl: string | null;
  title: string;
  /** The line under the title: a rating, a date, the arithmetic behind an hour count. */
  meta?: React.ReactNode;
  /** A small label ABOVE the row (Person Insights' "Highest rated" / "Hidden gem"). */
  eyebrow?: React.ReactNode;
  /** The right-hand column: a heart, a total, an "in your library" badge. */
  right?: React.ReactNode;
  /**
   * A slot under the meta line, INSIDE the text column — a proportion bar, when the row is part of
   * a ranking. Deliberately not full-row: run it under the poster too and it reads as a rule
   * separating two rows rather than as a measure belonging to this one.
   */
  below?: React.ReactNode;
  /** Navigates (a real anchor: right-click, new-tab, all of it). Wins over onClick when both given. */
  href?: string;
  onClick?: () => void;
  /** Keyboard cursor: wears the same clothes as hover, whichever way you reached the row. */
  selected?: boolean;
  /** A row you can see but not pick (an unreleased film in a watched door). Dims, refuses the click. */
  disabled?: boolean;
  className?: string;
}) {
  const src = posterUrl ? (tmdbImageFor(posterUrl, 40) ?? posterUrl) : null;
  const interactive = (!!href || !!onClick) && !disabled;

  const body = (
    <>
      {eyebrow}
      <div className="flex items-center gap-2.5">
        {/* 4px + a hairline ring so a small poster doesn't float on the dark surface. */}
        <div className="relative aspect-2/3 w-(--poster-xs) shrink-0 overflow-hidden rounded-thumb bg-surface-2 ring-1 ring-border-subtle">
          {src ? (
            <Image src={src} alt={title} fill loading="lazy" className="object-cover" sizes="40px" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Play size={11} className="text-text-tertiary" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className={cn(
            "truncate text-xs font-medium text-text-primary transition-colors",
            interactive && "group-hover:text-accent-watching-vivid",
          )}>
            {title}
          </p>
          {meta && <div className="mt-0.5 flex items-center gap-1.5">{meta}</div>}
          {below}
        </div>

        {right && <div className="shrink-0">{right}</div>}
      </div>
    </>
  );

  const rowClass = cn(
    "group block rounded-control px-2 py-1.5 text-left transition-colors",
    interactive && "hover:bg-surface-2",
    selected && "bg-surface-2",
    disabled && "cursor-not-allowed opacity-60",
    className,
  );

  if (disabled) return <div className={rowClass}>{body}</div>;
  if (href) return <Link href={href} className={rowClass}>{body}</Link>;
  if (onClick) {
    return (
      <div
        className={cn(rowClass, "cursor-pointer")}
        onClick={onClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}
      >
        {body}
      </div>
    );
  }
  return <div className={rowClass}>{body}</div>;
}
