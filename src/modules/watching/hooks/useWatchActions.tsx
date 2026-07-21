"use client";

import { useUpdateMedia } from "./useUpdateMedia";
import { useMediaView } from "./useMediaView";
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

/**
 * The extra columns are OPTIONAL on purpose. A surface that carries them (the detail page, and any
 * card whose select includes them) gets the coordinate lens and therefore the cour-aware year
 * stamping; one that doesn't degrades to exactly today's behaviour instead of breaking. That is what
 * lets the overlay be adopted surface by surface without a flag day.
 */
type Target =
  | (StatusFacts & {
      id: string;
      tmdb_id?: number;
      season_posters?: (string | null)[] | null;
      season_end_dates?: (string | null)[] | null;
      season_ratings?: Record<string, number> | null;
      cour_years?: Record<string, number> | null;
      cour_ratings?: Record<string, number> | null;
    })
  | null
  | undefined;

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
   * THE LENS, BUILT ONCE, HERE — so every surface inherits it.
   *
   * The season-boundary math (which season did I just finish, hence which year gets stamped and in
   * which column) is the one thing that differs between a lumped anime's flat storage and the cours
   * it actually displays. Building the view at the single writer means a card, a list row or a
   * surface not yet written cannot forget it: it never had to remember in the first place.
   */
  const view = useMediaView(media);

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

  // "Not out yet" — the one truth an unreleased film reduces to. Both the mark-watched and the
  // caught-up paths must refuse it: you can neither finish nor be caught up on a film that doesn't
  // exist. This is the backstop; the surfaces also hide the buttons (see `canMark`).
  const notOutYet = () => {
    toast.error(media?.type === "film" ? "This film isn't out yet." : "This isn't over yet.");
    return Promise.resolve(null);
  };

  return {
    isPending: updateMedia.isPending,

    /** The lens this surface is writing through — so it can SAY the position the way it wrote it. */
    view,

    /** True when calling `markWatched` would be an honest claim. Film: released. Series: over. */
    canComplete: !!media && canComplete(media),

    /** Whether to OFFER a completion affordance at all. An unreleased film gets none — there is
     *  nothing to mark. A series always does (watched, or caught up). */
    canMark: !!media && (canComplete(media) || media.type !== "film"),

    markWatched: () => {
      if (!media) return Promise.resolve(null);
      if (!canComplete(media)) return notOutYet();
      return write(markWatchedPatch(media, view), "");
    },

    markCaughtUp: async () => {
      if (!media) return null;
      // A film is never "caught up" — it's watched or it isn't. An unreleased one isn't even that.
      if (media.type === "film") return notOutYet();
      const patch = markCaughtUpPatch(media, view);
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
      media ? write(positionPatch(media, season, episode, kind, view), message) : Promise.resolve(null),

    /**
     * UNDO IS NOT A CORRECTION — and the toast is the only caller that can tell them apart.
     *
     * Moving backwards is normally a correction: you are fixing the record, and `last_watched_at`
     * stays where it is, because you really did watch this then. That rule is right, and it is why
     * stepping back deliberately leaves the date alone — the alternative (a jsonb history of every
     * position) was considered and refused.
     *
     * But the Undo on the "+1" toast is not a later fix. It cancels the write that just happened,
     * and that write stamped today. Leaving the stamp meant a mis-tap you took back two seconds
     * later still dragged the title to the top of Last Watched, dated today — the app remembering
     * an evening you never had.
     *
     * So this one caller hands the old value back. No new column: it is captured at the call site,
     * before the move, which is the only moment anyone knows it.
     *
     * ⚠️ `undefined` and `null` are DIFFERENT ANSWERS here, and treating them alike would have made
     * this fix destructive. `null` means "there was no date, restore none". `undefined` means the
     * surface never selected the column and does not KNOW — writing null on that would erase a real
     * date to undo a mis-tap. A surface that cannot answer simply doesn't get asked.
     */
    undoPosition: (season: number, episode: number, lastWatchedAt?: string | null) => {
      if (!media) return Promise.resolve(null);
      const patch = positionPatch(media, season, episode, "correction", view);
      if (!patch) return Promise.resolve(null);
      return write(lastWatchedAt === undefined ? patch : { ...patch, last_watched_at: lastWatchedAt }, "");
    },
  };
}
