import { cn } from "@/shared/utils/utils";
import { Badge } from "@/shared/components/ui/badge";

// The status a title carries on its poster. Watched carries none — it's the library's
// default state, and the rating badge already speaks for it.
export interface PosterStatus {
  label: string;
  tone: "watching" | "paused" | "dropped" | "want";
}

// Minimal shape: works for both a library item and a person-page title.
interface StatusSource {
  type: string;
  watched?: boolean;
  in_progress?: boolean;
  paused?: boolean;
  dropped?: boolean;
  want_to_watch?: boolean;
}

// Colour carries the meaning; the Badge fixes the form.
const TONE: Record<PosterStatus["tone"], string> = {
  watching: "var(--color-accent-watching-vivid)",
  paused: "#7dd3fc",
  dropped: "#fcd34d",
  want: "#c4b5fd",
};

// The season/episode position used to ride along here ("Watching  S3 · E7"). It's gone: two
// chips on a 100px-wide poster left neither room to breathe, and the position was the one
// that lost — half of them rendered as a truncated "S3 · ". A poster says WHERE a title
// stands, not how far in you are; that number belongs on the detail page, where it fits.
export function posterStatus(item: StatusSource): PosterStatus | null {
  if (item.watched) return null;
  if (item.dropped) return { label: "Dropped", tone: "dropped" };
  if (item.paused) return { label: "Paused", tone: "paused" };
  if (item.in_progress) return { label: "Watching", tone: "watching" };
  if (item.want_to_watch) return { label: "Want to watch", tone: "want" };
  return null;
}

/**
 * The ONE status badge on a poster, across Library, carousels and person pages — each had
 * hand-rolled its own. It's the shared Badge in its `glass` variant: a tint is transparent,
 * and over a bright poster that's unreadable, so this one carries its own dark backing.
 * Same form as every HEGON badge — only the MATERIAL changes, because the surface changed.
 */
export function PosterStatusBadge({ status, className }: { status: PosterStatus; className?: string }) {
  return (
    <>
      {/* Scrim — keeps the badge readable over a bright poster */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-linear-to-t from-black/95 via-black/50 to-transparent" />
      <div className={cn("absolute inset-x-2 bottom-2 z-10 flex items-end", className)}>
        {/* dot = the status colour. The word stays white — glass can't hold coloured text
            without being dimmed into a sticker, so the colour rides the dot instead. */}
        <Badge variant="glass" size="sm" dot color={TONE[status.tone]} className="shrink-0">
          {status.label}
        </Badge>
      </div>
    </>
  );
}
