"use client";

import { Panel } from "@/shared/components/ui/panel";
import { useRewatches } from "../../hooks/useRewatches";
import { useRatingStanding } from "../../hooks/useRatingPercentile";
import type { WatchingMedia } from "../../types";

const TYPE_WORD: Record<string, string> = { film: "films", serie: "series", anime: "animes" };

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border-subtle py-2.5 last:border-0">
      <span className="shrink-0 text-xs text-text-tertiary">{label}</span>
      <span className="text-right text-xs font-medium tabular-nums text-text-secondary">{value}</span>
    </div>
  );
}

function hours(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.round(minutes / 60);
  return `~${h}h`;
}

/**
 * Your numbers on a SERIES — the counterpart of Details, which holds the world's numbers.
 * Series only, on purpose: on a film every row here would be a duplicate (the runtime is in
 * the hero, the year is in the StatusCard, and the rank is already in My Take). A panel that
 * only repeats what's on screen is noise wearing the costume of information.
 * Everything is derived from what you actually logged; a row with no answer doesn't appear.
 */
export function QuickStats({ media }: { media: WatchingMedia }) {
  const { data: rewatches = [] } = useRewatches(media.id);
  const standing = useRatingStanding(media.user_id ?? null, media.type, media.user_rating ?? 0);

  const isSeries = media.type !== "film";
  const seasonEps = media.season_episodes ?? [];
  const totalEps = seasonEps.reduce((a, b) => a + b, 0) || media.episodes || 0;

  // Episodes you've actually gone through: everything for a finished show, and the seasons
  // behind you + your position in the current one otherwise.
  let watchedEps = 0;
  if (isSeries) {
    if (media.watched) watchedEps = totalEps;
    else if (media.in_progress || media.paused || media.dropped) {
      const s = media.current_season ?? 1;
      watchedEps =
        seasonEps.slice(0, Math.max(0, s - 1)).reduce((a, b) => a + b, 0) + (media.current_episode ?? 0);
    }
  }

  // Runtime on a series is PER EPISODE — multiplying it by the whole show would be nonsense.
  const runtime = media.runtime ?? 0;
  const firstPass = isSeries ? watchedEps * runtime : media.watched ? runtime : 0;
  const perRewatch = isSeries ? totalEps * runtime : runtime;
  const minutes = firstPass + rewatches.length * perRewatch;

  const seasonScores = Object.values(media.season_ratings ?? {}).filter((n) => typeof n === "number");
  const meanSeason = seasonScores.length
    ? seasonScores.reduce((a, b) => a + b, 0) / seasonScores.length
    : null;

  // season_years is a { "<season>": <year> } map, not a list.
  const years = Object.values(media.season_years ?? {}).filter((y): y is number => typeof y === "number");
  const watchedYear = media.watched_at ? new Date(media.watched_at).getFullYear() : null;
  const firstYear = years.length ? Math.min(...years) : watchedYear;
  const lastYear = years.length ? Math.max(...years) : watchedYear;

  const rows = [
    totalEps > 0 && (watchedEps > 0 || media.watched)
      ? { label: "Episodes watched", value: `${watchedEps} / ${totalEps}` }
      : null,
    minutes > 0 ? { label: "Watch time", value: hours(minutes) } : null,
    rewatches.length > 0 ? { label: "Rewatches", value: rewatches.length } : null,
    firstYear ? { label: "Started", value: firstYear } : null,
    lastYear && lastYear !== firstYear ? { label: "Finished", value: lastYear } : null,
    meanSeason != null ? { label: "Mean season score", value: `${meanSeason.toFixed(1)} / 10` } : null,
    standing
      ? {
          label: "Your rank",
          value: (
            <>
              #{standing.rank}{" "}
              <span className="font-normal text-text-tertiary">
                of your {TYPE_WORD[media.type] ?? "titles"}
              </span>
            </>
          ),
        }
      : null,
  ].filter(Boolean) as { label: string; value: React.ReactNode }[];

  // Films: every row would echo the hero, the StatusCard or My Take. Nothing logged yet:
  // an empty stats card is worse than no stats card. Either way — no panel.
  if (!isSeries || rows.length === 0) return null;

  return (
    <Panel title="Quick Stats" bleed>
      <div className="px-4 sm:px-5">
        {rows.map((r) => (
          <Row key={r.label} label={r.label} value={r.value} />
        ))}
      </div>
    </Panel>
  );
}
