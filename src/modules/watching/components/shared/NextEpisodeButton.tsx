"use client";

import { useRouter } from "next/navigation";
import { Check, Clock, Plus } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Hint } from "@/shared/components/ui/tooltip";
import { toast } from "@/shared/utils/toast";
import { useWatchActions } from "../../hooks/useWatchActions";
import { nextStep } from "../../lib/series-state";
import { formatPosition } from "../../lib/progress";
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
  const actions = useWatchActions(item);

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

    // A VIEWING: it dates the move and stamps the year of any season it just carried you past.
    // Everything else — the caught_up_at stamp, the "you cannot claim what hasn't aired" clamp —
    // comes from `positionPatch`, which is now the only thing in the app that writes a position.
    const patch = await actions.setPosition(step.season, step.episode, "viewing");
    if (!patch) return;

    toast(
      step.kind === "season"
        ? `Season ${step.season} started — ${formatPosition(step.season, step.episode)}`
        : formatPosition(step.season, step.episode),
      {
        duration: 6000,
        action: {
          label: "Undo",
          // A CORRECTION — and that word is doing real work. The Undo used to write the position
          // back and nothing else, leaving `caught_up_at` stamped: a show you'd never caught up to
          // would announce "New episodes" the next time one aired. Going through the same patch
          // builder makes that unforgettable rather than merely remembered. (The year stamped on
          // the way through stays: you did finish that season, and un-clicking doesn't un-watch it.)
          onClick: () => { void actions.setPosition(from.season, from.episode, "correction"); },
        },
      },
    );
  };

  return (
    <Button
      variant="overlay"
      size="xs"
      onClick={advance}
      disabled={actions.isPending}
      aria-label={`Mark ${formatPosition(step.season, step.episode)} as watched`}
      className="shrink-0"
    >
      <Plus />
      1 ep
    </Button>
  );
}
