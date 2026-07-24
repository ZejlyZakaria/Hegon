import Image from "next/image";
import { Play } from "lucide-react";
import { cn } from "@/shared/utils/utils";
import { tmdbImageFor } from "../../lib/tmdb-image";

/**
 * A COMPACT REFERENCE TO A TITLE — poster, name, one line of context, and whatever the surface
 * needs on the right.
 *
 * Not a card. The carousel tile and the library cell are for BROWSING: they carry marks, a rank, a
 * status, hover actions, a scale on hover. Dropping one of those into a list whose job is to
 * explain a number turns the explanation into a second library. This is the other shape — the one
 * Top Picks has been using on the stats page all along, extracted the day a second surface needed
 * it rather than copied.
 *
 * `xs` poster, and therefore `rounded-chip`: below about 64px the `tile` radius starts eating the
 * artwork. That rule is written down in the radius ladder; this is one of its call sites.
 */
export function MediaRow({
  posterUrl,
  title,
  meta,
  right,
  below,
  onClick,
  className,
}: {
  posterUrl: string | null;
  title: string;
  /** The line under the title: a rating, a date, the arithmetic behind an hour count. */
  meta?: React.ReactNode;
  /** The right-hand column: a heart, a total. */
  right?: React.ReactNode;
  /**
   * A slot under the meta line, INSIDE the text column — a proportion bar, when the row is part of
   * a ranking. Deliberately not full-row: run it under the poster too and it reads as a rule
   * separating two rows rather than as a measure belonging to this one.
   */
  below?: React.ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  const src = posterUrl ? (tmdbImageFor(posterUrl, 300) ?? posterUrl) : null;

  return (
    <div
      className={cn(
        // The negative margin pulls the hover surface out past the text so the highlight has some
        // air, without the row itself taking more width. ⚠️ It also CANCELS the parent's vertical
        // gap: `-m-1.5` against a `space-y-3` leaves ~0 between rows. A list of these must set its
        // own spacing accordingly (the breakdown panel uses `space-y-6`).
        "-mx-1.5 rounded-tile p-1.5 transition-colors",
        onClick && "cursor-pointer hover:bg-surface-2",
        className,
      )}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } } : undefined}
    >
      <div className="flex items-center gap-2.5">
        <div className="relative aspect-2/3 w-(--poster-xs) shrink-0 overflow-hidden rounded-chip">
          {src ? (
            <Image src={src} alt={title} fill loading="lazy" className="object-cover" sizes="36px" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-surface-2">
              <Play size={11} className="text-text-tertiary" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-text-primary">{title}</p>
          {meta && <div className="mt-0.5 flex items-center gap-1.5">{meta}</div>}
          {below}
        </div>

        {right && <div className="shrink-0">{right}</div>}
      </div>
    </div>
  );
}
