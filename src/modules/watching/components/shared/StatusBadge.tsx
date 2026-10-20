import { CheckCheck, Pause, Play, X } from "lucide-react";
import { cn } from "@/shared/utils/utils";
import { Badge } from "@/shared/components/ui/badge";
import { WatchlistMark, type WatchlistLevel } from "@/modules/watching/components/shared/Marks";
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
export function watchlistLevel(item: Pick<StatusSource, "type" | "priority_level" | "release_date" | "status">): WatchlistLevel {
  // The hub's own definition of "Waiting for" (service.ts AWAITING): a date ahead — or, for a film,
  // no date at all while TMDB says it is not released (an announced anime film without a date).
  const today = new Date().toISOString().slice(0, 10);
  const waiting = item.release_date
    ? item.release_date > today
    : item.type === "film" && !!item.status && item.status !== "released";
  if (waiting) return "waiting";
  return item.priority_level ?? "none";
}

// Poster consumption states use warm orange; personal ranking keeps the Watching teal.
const TONE: Record<Exclude<PosterStatus["tone"], "want">, string> = {
  watching: "#ffb477",
  caughtup: "#eea064",
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

/** A readable consumption label on artwork; colour and glyph retain their meanings. */
export function StatusMark({ status, className }: { status: PosterStatus; className?: string }) {
  if (status.tone === "want") return null;
  const label = status.tone === "watching" ? "In Progress" : status.tone === "caughtup" ? "Caught Up" : status.label;
  return (
    <Badge
      variant="solid"
      size="sm"
      color={TONE[status.tone]}
      className={cn("min-h-4 max-w-full shrink-0 gap-0.5 rounded-chip px-1 py-0.5 text-caption font-semibold leading-none tracking-normal [&_svg]:shrink-0", className)}
    >
      {status.tone === "watching" ? (
        <Play size={10} fill="currentColor" />
      ) : status.tone === "caughtup" ? (
        <CheckCheck size={11} strokeWidth={2.5} />
      ) : status.tone === "paused" ? (
        <Pause size={10} fill="currentColor" />
      ) : (
        <X size={11} strokeWidth={2.5} />
      )}
      <span className="min-w-0 text-left leading-tight">{label}</span>
    </Badge>
  );
}

/**
 * Consumption labels sit bottom-left; watchlist bookmarks retain their top-left placement.
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
    <div className={cn("absolute bottom-2 left-2 right-2 z-10 flex", className)}>
      <StatusMark status={status} />
    </div>
  );
}
