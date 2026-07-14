"use client";

import { useUpdateMedia } from "./useUpdateMedia";
import { useWatchingGoals } from "./useWatchingGoals";
import { goalWouldCount } from "../lib/goal-contribution";
import { GoalRippleToast } from "../components/detail/GoalRippleToast";
import {
  canComplete,
  dropPatch,
  markCaughtUpPatch,
  markWatchedPatch,
  pausePatch,
  positionPatch,
  resumePatch,
  startWatchingPatch,
  wantToWatchPatch,
  type StatusFacts,
  type StatusPatch,
} from "../lib/watch-status";
import { isDemoReadOnlyError } from "@/shared/utils/demo-guard";
import { toast } from "@/shared/utils/toast";

type Target = (StatusFacts & { id: string }) | null | undefined;

/**
 * ONE set of watch actions, for every surface that has ever had them.
 *
 * The detail page, the "…" menu on every poster card, and the rows inside a list each carried their
 * own hand-written copy of "mark as watched" — and the copies drifted, as copies do. The cards were
 * still offering "Mark as finished" on a series that is still airing, writing `watched: true` over
 * a blank position: the precise shape of the rows a migration had just spent a day repairing.
 *
 * The rules now live in `lib/watch-status.ts` as pure functions of the row; this is only the
 * plumbing around them — the mutation, the toasts, the Goals ripple. A new surface calls this and
 * inherits every rule, including the ones nobody has thought of yet.
 *
 * Each action returns the patch it wrote (or null), so a caller holding local UI state — the detail
 * page's steppers — can follow the move without re-deriving it.
 */
export function useWatchActions(media: Target) {
  const updateMedia = useUpdateMedia();
  const { data: watchingGoals = [] } = useWatchingGoals();

  /**
   * The Goals ripple — the felt moment, the count animating up — follows THE FACT, not the button.
   * `watched` became true; it does not matter which surface said so. That is why "I watched through
   * season 4" of a four-season show, which completes it, ripples exactly like the Finish button:
   * the same thing happened.
   */
  const rippleWatched = () => {
    if (!media) return;
    const matched = watchingGoals.filter((g) => goalWouldCount(g, media.type));
    if (matched.length === 0) {
      toast("Marked as watched.");
      return;
    }
    matched.forEach((g) => {
      const old = g.metric_current;
      toast.custom(() => (
        <GoalRippleToast title={g.title} oldCount={old} newCount={old + 1} target={g.metric_target ?? 0} />
      ));
    });
  };

  const write = async (patch: StatusPatch | null, message: string): Promise<StatusPatch | null> => {
    if (!media || !patch) return null;
    try {
      // `type` never reaches the database — it scopes the invalidations, so pausing an anime
      // stops refetching the film carousels.
      await updateMedia.mutateAsync({ id: media.id, type: media.type, ...patch });
      if (patch.watched === true) rippleWatched();
      else if (message) toast(message);
      return patch;
    } catch (err) {
      // The demo guard toasts on its own; useUpdateMedia rolls the optimistic update back.
      if (!isDemoReadOnlyError(err)) toast.error("Failed to update.");
      return null;
    }
  };

  return {
    isPending: updateMedia.isPending,

    /** True when calling `markWatched` would be an honest claim. A series: only once it's over. */
    canComplete: !!media && canComplete(media),

    markWatched: () => (media ? write(markWatchedPatch(media), "") : Promise.resolve(null)),

    markCaughtUp: async () => {
      if (!media) return null;
      const patch = markCaughtUpPatch(media);
      if (!patch) {
        toast.error("We don't know what has aired for this title yet.");
        return null;
      }
      return write(patch, "All caught up — waiting on what comes next.");
    },

    /** Not a status, but it lives on the same menus and it was written by hand in three places too. */
    toggleFavorite: () =>
      media
        ? write({ favorite: !media.favorite }, media.favorite ? "Removed from favorites." : "Added to favorites.")
        : Promise.resolve(null),

    startWatching: () => write(startWatchingPatch(), "Started watching."),
    wantToWatch: () => write(wantToWatchPatch(), "Added to Want to Watch."),
    pause: () => write(pausePatch(), "Paused."),
    drop: (reason: string | null) => write(dropPatch(reason), "Marked as dropped."),
    resume: () => write(resumePatch(), "Back to watching."),

    /**
     * `kind` is the fact only the caller knows: "+1" and the steppers are a VIEWING (they date it,
     * and stamp the year of a season you have just finished); "I watched through season 3" is a
     * CORRECTION of the record, and dating a memory from 2018 with today's year would swap one
     * false claim for another.
     */
    setPosition: (season: number, episode: number, kind: "viewing" | "correction", message = "") =>
      media ? write(positionPatch(media, season, episode, kind), message) : Promise.resolve(null),
  };
}
