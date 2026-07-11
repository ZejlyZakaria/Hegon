import { cn } from "@/shared/utils/utils";

// The status a title carries on its poster. Watched carries none — it's the library's
// default state, and the rating badge already speaks for it.
export interface PosterStatus {
  label: string;
  tone: "watching" | "paused" | "dropped" | "want";
  position?: string;   // "S3 · E7" — series only
}

// Minimal shape: works for both a library item and a person-page title.
interface StatusSource {
  type: string;
  watched?: boolean;
  in_progress?: boolean;
  paused?: boolean;
  dropped?: boolean;
  want_to_watch?: boolean;
  current_season?: number | null;
  current_episode?: number | null;
}

const TONE: Record<PosterStatus["tone"], string> = {
  watching: "text-accent-watching-vivid",
  paused: "text-sky-300",
  dropped: "text-amber-300",
  want: "text-violet-300",
};

export function posterStatus(item: StatusSource): PosterStatus | null {
  if (item.watched) return null;
  if (item.dropped) return { label: "Dropped", tone: "dropped" };
  if (item.paused) return { label: "Paused", tone: "paused" };
  if (item.in_progress) {
    const isSeries = item.type === "serie" || item.type === "anime";
    const position =
      isSeries && item.current_season
        ? `S${item.current_season} · E${item.current_episode ?? 0}`
        : undefined;
    return { label: "Watching", tone: "watching", position };
  }
  if (item.want_to_watch) return { label: "Want to watch", tone: "want" };
  return null;
}

/**
 * The ONE status badge on a poster, across Library, carousels and person pages — each had
 * hand-rolled its own. Glass, not tinted: it sits on artwork, so it needs the dark scrim to
 * stay legible whatever the poster underneath. Colour carries the meaning, form is fixed.
 */
export function PosterStatusBadge({ status, className }: { status: PosterStatus; className?: string }) {
  return (
    <>
      {/* Scrim — keeps the badge readable over a bright poster */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-linear-to-t from-black/95 via-black/50 to-transparent" />
      <div className={cn("absolute inset-x-2 bottom-2 z-10 flex items-end justify-between gap-1.5", className)}>
        <span
          className={cn(
            "shrink-0 rounded-chip bg-black/75 px-1.5 py-0.5 text-[10px] font-bold ring-1 ring-white/10 backdrop-blur-sm",
            TONE[status.tone],
          )}
        >
          {status.label}
        </span>
        {status.position && (
          <span className="min-w-0 truncate rounded-chip bg-black/75 px-1.5 py-0.5 text-[10px] font-semibold text-white/90 ring-1 ring-white/10 backdrop-blur-sm">
            {status.position}
          </span>
        )}
      </div>
    </>
  );
}
