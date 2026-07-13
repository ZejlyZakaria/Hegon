"use client";

import { useRouter } from "next/navigation";
import { Check, Clock, Plus } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Hint } from "@/shared/components/ui/tooltip";
import { toast } from "@/shared/utils/toast";
import { isDemoReadOnlyError } from "@/shared/utils/demo-guard";
import { useUpdateMedia } from "../../hooks/useUpdateMedia";
import { nextStep, isSeasonComplete, caughtUpAt } from "../../lib/series-state";
import { formatPosition } from "../../lib/progress";
import { stampSeasons, seasonRange } from "../../lib/season-years";
import type { WatchingMedia } from "../../types";

/**
 * "+1" — one tap, one episode. And it CANNOT lie.
 *
 * Everything it does is derived from `season_aired` (what has actually been broadcast), never
 * from `season_episodes` (what TMDB has merely announced). So:
 *
 *   · it stops at the last AIRED episode. You cannot declare you watched something that does
 *     not exist yet — at the edge it stops being a "+1" and says "Caught up".
 *   · "Finish" only appears when the show is really OVER (ended or cancelled). An ongoing show
 *     cannot be completed, so the app never offers it.
 *   · rolling into a new season stamps the finished season's year — but only if that season is
 *     FULLY aired. Stamping a year on a season still coming out would date a memory you have
 *     not had.
 *
 * With no airing data (a title added before the sync ever ran), it renders NOTHING. That's
 * deliberate: if we don't know what exists in the world, we do not let you claim you saw it.
 * Run `node scripts/sync-series.mjs --apply`.
 */
export function NextEpisodeButton({ item }: { item: WatchingMedia }) {
  const router = useRouter();
  const updateMedia = useUpdateMedia();

  const step = nextStep(item);
  if (!step) return null;

  // Everything aired, and it's over → finishing a SHOW is not the same gesture as finishing an
  // episode. It stamps every season, ripples into Goals and Habits, and deserves the rating you
  // are about to have an opinion about. That flow lives on the detail page and is not
  // re-implemented on a card: this module's status logic has already cost five audited bugs.
  if (step.kind === "finish") {
    return (
      <Button
        variant="overlay"
        size="xs"
        onClick={(e) => { e.stopPropagation(); router.push(`/perso/watching/${item.id}`); }}
        className="shrink-0"
      >
        <Check />
        Finish
      </Button>
    );
  }

  // Everything aired, but the story isn't over. You are not "done" — you are WAITING. Saying
  // "watched" here is the lie the whole model was built to stop telling.
  if (step.kind === "caught-up") {
    return (
      <Hint label="You've seen everything that's out. Waiting on the next season.">
        <span className="inline-flex h-6 shrink-0 cursor-default items-center gap-1 rounded-control px-2 text-xs font-medium text-white/60 bg-white/10">
          <Clock size={12} />
          Caught up
        </span>
      </Hint>
    );
  }

  const advance = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const from = { season: item.current_season ?? 1, episode: item.current_episode ?? 0 };

    // A season's year is only stamped when the season is BOTH fully aired and behind you.
    // And `season_years` MUST be loaded: stampSeasons merges into the existing map, so merging
    // into `undefined` and writing the result would REPLACE the jsonb column with one entry and
    // wipe every year you'd set by hand.
    const crossed = step.kind === "season" ? seasonRange(from.season, step.season - 1) : [];
    const stampable = crossed.filter((s) => isSeasonComplete(item, s));
    const seasonYears =
      stampable.length > 0 && item.season_years !== undefined
        ? stampSeasons(item.season_years, stampable, new Date().getFullYear())
        : null;

    try {
      await updateMedia.mutateAsync({
        id: item.id,
        current_season: step.season,
        current_episode: step.episode,
        // Reaching the frontier by tapping "+1" is how most people get there — and it was the one
        // path that never recorded it. Without this stamp the title can never light up as NEW when
        // the next season drops: `seriesState` would only ever see "behind", never "behind AFTER
        // being caught up". A position write recomputes it, always.
        caught_up_at: caughtUpAt({ ...item, current_season: step.season, current_episode: step.episode }, item.caught_up_at),
        ...(seasonYears ? { season_years: seasonYears } : {}),
        // This button only ever moves forward, so it always dates the viewing.
        last_watched_at: new Date().toISOString(),
      });

      toast(
        step.kind === "season"
          ? `Season ${step.season} started — ${formatPosition(step.season, step.episode)}`
          : formatPosition(step.season, step.episode),
        {
          duration: 6000,
          action: {
            label: "Undo",
            // Put the position back. The year stamped on the way through is left alone: you did
            // finish that season, and un-clicking a button doesn't un-watch it.
            onClick: () => {
              // No `last_watched_at` here: undoing is a correction, not a viewing.
              updateMedia.mutate({
                id: item.id,
                current_season: from.season,
                current_episode: from.episode,
              });
            },
          },
        },
      );
    } catch (err) {
      if (isDemoReadOnlyError(err)) return;
      // useUpdateMedia already rolls the optimistic update back and toasts.
    }
  };

  return (
    <Button
      variant="overlay"
      size="xs"
      onClick={advance}
      disabled={updateMedia.isPending}
      aria-label={`Mark ${formatPosition(step.season, step.episode)} as watched`}
      className="shrink-0"
    >
      <Plus />
      1 ep
    </Button>
  );
}
