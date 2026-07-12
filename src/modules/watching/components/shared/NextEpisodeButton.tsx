"use client";

import { useRouter } from "next/navigation";
import { Check, Plus } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { toast } from "@/shared/utils/toast";
import { isDemoReadOnlyError } from "@/shared/utils/demo-guard";
import { useUpdateMedia } from "../../hooks/useUpdateMedia";
import { nextEpisode, formatPosition } from "../../lib/progress";
import { stampSeasons, seasonRange } from "../../lib/season-years";
import type { WatchingMedia } from "../../types";

/**
 * "+1" — one tap, one episode.
 *
 * This is the most frequent gesture in the product, and it used to cost four or five taps:
 * home → find the card → open the detail page → find the stepper. The card was already
 * printing "S03 E03" at you; it just wouldn't let you say you'd watched E04.
 *
 * At the END of a season it rolls over on its own and stamps the year of the season you just
 * finished — the same auto-capture the detail page does, so your Watch History stays true
 * whichever way you advanced.
 *
 * At the END of the SHOW it stops being a "+1" and becomes "Finish", which opens the detail
 * page. Finishing a show is not the same gesture as finishing an episode: it stamps every
 * season, ripples into Goals and Habits, and deserves the rating you're about to have an
 * opinion about. That flow lives in one place and is not re-implemented on a card — this
 * module's status logic has already cost five audited bugs.
 */
export function NextEpisodeButton({ item }: { item: WatchingMedia }) {
  const router = useRouter();
  const updateMedia = useUpdateMedia();

  const step = nextEpisode(item);
  if (!step) return null;

  const isFinale = step.kind === "finale";

  const advance = async (e: React.MouseEvent) => {
    e.stopPropagation();   // the card itself navigates — this button must not

    if (isFinale) {
      router.push(`/perso/watching/${item.id}`);
      return;
    }

    const from = { season: item.current_season ?? 1, episode: item.current_episode ?? 0 };

    // Crossing into a new season means the one behind you is done → stamp its year, without
    // overwriting a year you set by hand.
    //
    // `season_years` MUST be loaded for this to be safe: stampSeasons merges into the existing
    // map, so merging into `undefined` and writing the result would REPLACE the whole jsonb
    // column with one entry and wipe every year you'd set. The carousel query loads it
    // (SECTION_COLUMNS) — but a caller that doesn't must not be allowed to silently destroy it.
    const canStamp = step.kind === "season" && item.season_years !== undefined;
    const seasonYears = canStamp
      ? stampSeasons(item.season_years, seasonRange(from.season, step.season - 1), new Date().getFullYear())
      : null;

    try {
      await updateMedia.mutateAsync({
        id: item.id,
        current_season: step.season,
        current_episode: step.episode,
        ...(seasonYears ? { season_years: seasonYears } : {}),
      });

      toast(
        step.kind === "season"
          ? `Season ${step.season} started — ${formatPosition(step.season, step.episode)}`
          : formatPosition(step.season, step.episode),
        {
          duration: 6000,
          action: {
            label: "Undo",
            // Put the position back exactly as it was. The season year stamped on the way
            // through is left alone: you did finish that season, and un-clicking a button
            // doesn't un-watch it.
            onClick: () => {
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
      aria-label={isFinale ? "Finish this show" : `Mark ${formatPosition(step.season, step.episode)} as watched`}
      className="shrink-0"
    >
      {isFinale ? <Check /> : <Plus />}
      {isFinale ? "Finish" : "1 ep"}
    </Button>
  );
}
