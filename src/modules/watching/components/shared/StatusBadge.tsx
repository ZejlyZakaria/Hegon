import { CheckCheck, Pause, Play, X } from "lucide-react";
import { cn } from "@/shared/utils/utils";
import { Hint } from "@/shared/components/ui/tooltip";
import { OVERLAY_CIRCLE, OVERLAY_CLUSTER, WatchlistMark, type WatchlistLevel } from "@/modules/watching/components/shared/Marks";
import { seriesState, type SeriesFacts } from "@/modules/watching/lib/series-state";

// The status a title carries on its poster. Watched carries none — it's the library's
// default state, and the rating badge already speaks for it.
export interface PosterStatus {
  label: string;
  tone: "watching" | "caughtup" | "paused" | "dropped" | "want";
  /** Want only: the bookmark's colour (priority, none, or waiting for release). */
  level: WatchlistLevel | null;
}

// Minimal shape: works for both a library item and a person-page title. The series facts are what
// tells "watching" from "caught up" — a show you are level with is not a show you are behind on.
interface StatusSource extends SeriesFacts {
  type: string;
  watched?: boolean;
  in_progress?: boolean;
  paused?: boolean;
  dropped?: boolean;
  want_to_watch?: boolean;
  priority_level?: "high" | "medium" | "low" | null;
  /** A release still ahead = "Waiting for": the bookmark stays violet until the title is out. */
  release_date?: string | null;
}

/**
 * THE BOOKMARK'S COLOUR (owner, 2026-09-17): a title that is not out yet is "Waiting for", not a
 * priority you can act on — the quick-add's default "medium" would paint every future film amber.
 * Violet until the release date; then the priority, whatever it is — and WHITE when there is none:
 * violet means waiting, nothing else.
 */
export function watchlistLevel(item: Pick<StatusSource, "priority_level" | "release_date">): WatchlistLevel {
  if (item.release_date && item.release_date > new Date().toISOString().slice(0, 10)) return "waiting";
  return item.priority_level ?? "none";
}

// Colour carries the meaning — the same three the list views' dots already speak.
const TONE: Record<Exclude<PosterStatus["tone"], "want">, string> = {
  watching: "var(--color-accent-watching-vivid)",
  caughtup: "var(--color-accent-watching-vivid)",
  paused: "#7dd3fc",
  dropped: "#fcd34d",
};

// The season/episode position used to ride along here ("Watching  S3 · E7"). It's gone: two
// chips on a 100px-wide poster left neither room to breathe, and the position was the one
// that lost — half of them rendered as a truncated "S3 · ". A poster says WHERE a title
// stands, not how far in you are; that number belongs on the detail page, where it fits.
export function posterStatus(item: StatusSource): PosterStatus | null {
  if (item.watched) return null;
  if (item.dropped) return { label: "Dropped", tone: "dropped", level: null };
  if (item.paused) return { label: "Paused", tone: "paused", level: null };
  if (item.in_progress) {
    // Caught up = you have seen everything that aired and the show goes on — its own glyph (the
    // double check the Caught up badge already wears), not the play of a show you are behind on.
    const caught = item.type !== "film" && seriesState(item) === "caught-up";
    return caught ? { label: "Caught up", tone: "caughtup", level: null } : { label: "Watching", tone: "watching", level: null };
  }
  if (item.want_to_watch) return { label: "Want to watch", tone: "want", level: watchlistLevel(item) };
  return null;
}

/**
 * WHERE A TITLE STANDS, said by a glyph and a colour — owner-decided 2026-09-16. It was a chip
 * with the word, at the bottom of the poster, over a scrim that darkened 40 % of the artwork.
 * The glyphs are the video player's own (▶ ❚❚ ✕), the three most universal icons there are, and
 * the colours are the ones the list views' dots already use — nothing new to learn, and the poster
 * is artwork again. The word survives in the list views and in the tooltip.
 *
 * Not a ribbon: a ribbon hangs from an edge and says a RANK or a FLAG (Top 10, award, bookmark).
 * A status is a state — it takes the circle, the heart's own object, in the left cluster (info).
 * The colour is the FILL and the glyph is BLACK — the pairing the module already speaks (the
 * accent button, the followed FollowMark: teal disc, dark glyph). A coloured glyph on the dark
 * disc was near invisible over a busy poster; white on the fill didn't match (owner, twice).
 */
export function StatusMark({ status, className }: { status: PosterStatus; className?: string }) {
  if (status.tone === "want") return null;
  const color = TONE[status.tone];
  return (
    <Hint label={status.label}>
      <span className={cn(OVERLAY_CIRCLE, "text-black/85", className)} style={{ backgroundColor: color }} aria-label={status.label}>
        {status.tone === "watching" ? (
          <Play size={11} fill="currentColor" />
        ) : status.tone === "caughtup" ? (
          <CheckCheck size={12} strokeWidth={2.5} />
        ) : status.tone === "paused" ? (
          <Pause size={11} fill="currentColor" />
        ) : (
          <X size={12} strokeWidth={2.5} />
        )}
      </span>
    </Hint>
  );
}

/**
 * The ONE status on a poster, SELF-PLACED — for the plain grids (a person's titles) whose tile
 * carries nothing else in the corner. A surface that composes its own left cluster (the library
 * card: Top 10, heart) places `WatchlistMark` / `StatusMark` itself, so nothing overlaps.
 */
export function PosterStatusBadge({ status, className }: { status: PosterStatus; className?: string }) {
  if (status.tone === "want") {
    return (
      <div className={cn("absolute left-2 top-0 z-10", className)}>
        <WatchlistMark level={status.level ?? "none"} />
      </div>
    );
  }
  return (
    <div className={cn(OVERLAY_CLUSTER, "left-2", className)}>
      <StatusMark status={status} />
    </div>
  );
}
