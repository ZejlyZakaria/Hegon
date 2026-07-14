"use client";

import { Panel } from "@/shared/components/ui/panel";
import { useRewatches } from "../../hooks/useRewatches";
import { useRatingStanding } from "../../hooks/useRatingPercentile";
import { airedCount, lastWatched, reachedEntries, seriesState, watchedCount } from "../../lib/series-state";
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
  // TWO numbers, TWO jobs.
  //   airedEps → what you could have watched. It's the ceiling on `watchedEps` and on watch time:
  //              you cannot have spent hours on episodes that don't exist.
  //   totalEps → what the show IS. It's the DENOMINATOR, and it has to stay honest: "22 / 22"
  //              reads as finished on a series that's a third of the way through its season.
  //              "22 / 26" says the true thing — you're up to date, and more is coming.
  //
  // Both come from series-state.ts. This component used to carry its own copy of the counting —
  // a third implementation of it, next to the canonical one and the Stats page's (which counted
  // the announced). Three copies of "how many episodes have I watched" is how one screen ends up
  // disagreeing with the next about the same title.
  const airedEps = airedCount(media);
  const announcedList = media.season_episodes ?? [];
  const totalEps = announcedList.reduce((a, b) => a + b, 0) || media.episodes || airedEps;

  const engaged = media.in_progress || media.paused || media.dropped;
  const watchedEps = !isSeries ? 0 : media.watched ? airedEps : engaged ? watchedCount(media) : 0;

  // Runtime on a series is PER EPISODE — multiplying it by the whole show would be nonsense.
  // A rewatch replays what EXISTS, not what's been announced: you can't rewatch episode 8 of a
  // season that has four.
  const runtime = media.runtime ?? 0;
  const firstPass = isSeries ? watchedEps * runtime : media.watched ? runtime : 0;
  const perRewatch = isSeries ? airedEps * runtime : runtime;
  const minutes = firstPass + rewatches.length * perRewatch;

  // `season_years` and `season_ratings` only ever GROW. Step your position back — a correction,
  // an un-drop — and the stamps for seasons you no longer claim just sit there. One-Punch Man
  // kept reporting 2019 (season 2) after you moved back to season 1. The data isn't wrong and
  // isn't deleted; it simply must not be READ for a season you haven't reached.
  const seasonScores = reachedEntries(media, media.season_ratings);
  const meanSeason = seasonScores.length
    ? seasonScores.reduce((a, b) => a + b, 0) / seasonScores.length
    : null;

  const years = reachedEntries(media, media.season_years);
  const watchedYear = media.watched_at ? new Date(media.watched_at).getFullYear() : null;
  const firstYear = years.length ? Math.min(...years) : watchedYear;

  // "FINISHED" BELONGS TO EXACTLY ONE STATE — completed. On House of the Dragon this row read
  // "Finished 2024" — the year you finished SEASON 2, on a series that is still running. The
  // number was right; the word was a lie.
  const finished = seriesState({ ...media }) === "completed" || (media.type === "film" && media.watched);

  // "Last watched" has TWO possible sources, and which one is true depends on where you stand —
  // see lastWatched() in series-state.ts. In short: the year of a season you finished always
  // beats a timestamp (a timestamp only records when you CLICKED, and correcting a position with
  // the stepper is a forward move, so it dates itself "today"). The timestamp only speaks when
  // you're mid-season, where no year exists yet.
  const last = lastWatched(media);
  const lastValue =
    last?.kind === "date"
      ? new Date(last.value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
      : last?.kind === "year"
        ? String(last.value)
        : null;

  // "Started" is only a fact when there's a SPAN. A show you watched inside a single year reduces
  // it to a lone "Started 2019" — which repeats the year the StatusCard already gives you, and
  // implies an ongoing stretch that ended the same year. One number, one row, no echo.
  const spansYears = !!lastValue && lastValue !== String(firstYear);

  const rows = [
    totalEps > 0 && (watchedEps > 0 || media.watched)
      ? { label: "Episodes watched", value: `${watchedEps} / ${totalEps}` }
      : null,
    minutes > 0 ? { label: "Watch time", value: hours(minutes) } : null,
    rewatches.length > 0 ? { label: "Rewatches", value: rewatches.length } : null,
    firstYear && spansYears ? { label: "Started", value: firstYear } : null,
    spansYears
      ? { label: finished ? "Finished" : "Last watched", value: lastValue }
      : null,
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
