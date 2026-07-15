// =====================================================
// WATCHING — list transition resolver (pure, testable)
// =====================================================
//
// Single source of truth for "can this media move into the target list, and
// what happens when it does". Consumed by both AddMediaModal (UI conflict
// banner) and useAddMedia (write guard + branch selection) so the two can
// never diverge.

import { isFinished } from "./series-state";
import type { ListType, MediaType } from "../types";

/** Minimal flag set needed to decide a transition. Both `ExistingMediaEntry`
 *  (modal) and the `getExistingMediaItem` row (mutation) satisfy this. */
export interface MediaStateFlags {
  watched: boolean;
  /** @deprecated No longer read for any decision — Recently Watched is derived from `watched_at`.
   *  Optional so callers can stop threading it; the DB column awaits a cleanup migration. */
  recently_watched?: boolean;
  priority: number | null;
  in_progress: boolean;
  want_to_watch: boolean;
  /** On-hold / abandoned — already in your collection, just set aside. Optional so
   *  existing callers/tests still satisfy the shape (treated as false when absent). */
  paused?: boolean;
  dropped?: boolean;
  /** Optional — only used to enrich the (allowed) banner text in the UI.
   *  The write side never reads allowed-message text, so it can omit this. */
  user_rating?: number | null;
  /**
   * THE FACTS. This resolver used to reason from the LISTS alone — "you are In Progress and you are
   * heading for Recently Watched, therefore YOU FINISHED IT" — which is, word for word, the line we
   * deleted from the write path (`watched = listContext === …`). It survived here, in the sentences.
   * So the app stopped lying to the database and went on lying to your face: it told you that you
   * had finished House of the Dragon, a show that is still airing.
   *
   * A destination is a CONSEQUENCE, never a promise. Give the resolver what is true, and it stops
   * having to guess. (Optional: an older caller that omits them gets the previous behaviour.)
   */
  type?: MediaType;
  status?: string | null;
}

export type TransitionAction =
  | "insert" // no existing entry → fresh insert
  | "blocked" // transition not allowed
  | "update:inProgress" // move existing entry into In Progress
  | "update:topTen" // rank existing entry in Top 10
  | "update:merge"; // recentlyWatched / library / wantToWatch onto existing

export interface TransitionResult {
  /** false → the write must be refused and the UI must disable submit. */
  allowed: boolean;
  /** Which write branch the mutation should take. */
  action: TransitionAction;
  /** Banner text. null → no banner (clean add, nothing to warn about). */
  message: string | null;
  /** Lists the media currently belongs to (for display). */
  existingLists: string[];
}

/** Human labels for each list context. */
export const LIST_NAMES: Record<ListType, string> = {
  library: "Library",
  recentlyWatched: "Recently Watched",
  topTen: "Top 10",
  inProgress: "In Progress",
  wantToWatch: "Want to Watch",
};

/** Maps an allowed transition onto the write branch the mutation should run. */
function actionFor(target: ListType): Exclude<TransitionAction, "insert" | "blocked"> {
  if (target === "inProgress") return "update:inProgress";
  if (target === "topTen") return "update:topTen";
  return "update:merge"; // recentlyWatched, library, wantToWatch
}

/** The facts about the SHOW — true whether or not you own it. From the row, or from TMDB. */
export interface WorldFacts {
  type?: MediaType;
  status?: string | null;
}

/** Can this title HONESTLY be called watched? A film: always. A series: only once it is over. */
function canFinish(facts: WorldFacts | null | undefined): boolean {
  // Unknown facts → the old, permissive behaviour. We never block on ignorance.
  if (!facts?.type) return true;
  return facts.type === "film" || isFinished(facts.status);
}

export function resolveTransition(
  existing: MediaStateFlags | null,
  target: ListType,
  /** The candidate's facts, for a title you don't own yet. Falls back to the row's own. */
  world?: WorldFacts,
): TransitionResult {
  const facts = world ?? existing ?? null;

  const listsOf = (e: MediaStateFlags): string[] => {
    const out: string[] = [];
    if (e.priority != null) out.push("Top 10");
    if (e.in_progress) out.push("In Progress");
    if (e.paused) out.push("Paused");
    if (e.dropped) out.push("Dropped");
    if (e.want_to_watch) out.push("Want to Watch");
    // "Recently Watched" is no longer a membership — it's a VIEW, a date-sorted slice of your
    // watched titles. A watched title is simply in your Library; whether it also shows in the
    // Recently Watched rail depends on how recent it is, not on a flag. So there is one label.
    if (e.watched && e.priority == null) out.push("Library");
    return out;
  };

  /**
   * ⛔ RECENTLY WATCHED IS A CONSEQUENCE OF HAVING FINISHED SOMETHING.
   *
   * It is derived from `watched_at`, and `watched_at` belongs to a title you actually finished. So a
   * series that is still airing cannot be recently watched — not awkwardly, IMPOSSIBLY. Letting the
   * button through and quietly filing the title somewhere else was still a lie: the modal is called
   * "Add to Recently Watched", and the name of a door is a promise.
   *
   * This door exists for the show you binged in a week and never tracked — you record it after the
   * fact. There is nothing to record after the fact about a show whose next episode airs on Sunday.
   *
   * It applies BEFORE the "no existing entry" shortcut, because a brand-new ongoing series arriving
   * through this door is the same lie, told about a title you don't own yet.
   *
   * (The Top 10 is deliberately NOT covered: ranking is not watching. You may love a show that
   * isn't over.)
   */
  if (target === "recentlyWatched" && !canFinish(facts)) {
    return {
      allowed: false,
      action: "blocked",
      message: existing
        ? `You're already watching this, and it isn't over yet. Track it from its page — it'll land here when it ends.`
        : `Recently Watched is for titles you've finished. This one is still airing — add it from In Progress.`,
      existingLists: existing ? listsOf(existing) : [],
    };
  }

  // No existing entry → clean insert, nothing to warn about.
  if (!existing) {
    return { allowed: true, action: "insert", message: null, existingLists: [] };
  }

  // "In your Library" = watched, and not ranked in the Top 10. That is the whole watched
  // collection; Recently Watched is a date-sorted window onto it, not a separate place, so the
  // stale `recently_watched` boolean no longer partitions this.
  const isInLibrary = existing.watched && existing.priority == null;
  const isInTopTen = existing.priority != null;
  const isInProgress = existing.in_progress;
  const isInWantToWatch = existing.want_to_watch;
  const isPaused = !!existing.paused;
  const isDropped = !!existing.dropped;

  const existingLists = listsOf(existing);

  const blocked = (message: string): TransitionResult => ({
    allowed: false,
    action: "blocked",
    message,
    existingLists,
  });
  const allow = (message: string | null): TransitionResult => ({
    allowed: true,
    action: actionFor(target),
    message,
    existingLists,
  });

  // 1. Already in the target list → nothing to do. (There is no "already in Recently Watched": it's
  // a view, not a membership. Re-adding a watched title there just re-affirms it — handled below.)
  const isAlreadyInTarget =
    (target === "library" && isInLibrary) ||
    (target === "topTen" && isInTopTen) ||
    (target === "inProgress" && isInProgress) ||
    (target === "wantToWatch" && isInWantToWatch);

  if (isAlreadyInTarget) {
    return blocked(`This media is already in "${LIST_NAMES[target]}".`);
  }

  // Paused / dropped = already in your collection, just set aside. Re-adding via the
  // Add modal is blocked (you manage it from its detail page) — same "it already
  // exists" UX as the other memberships, with an honest banner.
  if (isPaused || isDropped) {
    return blocked(`This title is already in your collection (${isDropped ? "dropped" : "paused"}). Manage it from its page.`);
  }

  // 2. Contextual (allowed) transitions — friendly amber message.
  const ratingText = existing.user_rating ? ` (rated ${existing.user_rating}/10)` : "";
  let contextualMessage = "";

  const finishable = canFinish(facts);

  if (target === "topTen") {
    // RANKING IS NOT WATCHING. It never was — the Top 10 is a favourite and a rank, and asserting
    // "watched" alongside it was a door that declared a running show finished, silently, for the
    // crime of being loved. So this target stays open to a series that is still airing.
    if (isInLibrary) contextualMessage = `This media is in your Library${ratingText}. It will be added to your Top 10.`;
    else if (isInWantToWatch) contextualMessage = finishable
      ? `You're marking this as watched AND ranking it in your Top 10.`
      : `You're ranking this in your Top 10 — tell us how far you got.`;
    else if (isInProgress) contextualMessage = finishable
      ? `You finished this one! It will be ranked in your Top 10.`
      : `It's still airing — your progress is kept, and it will be ranked in your Top 10.`;
  } else if (target === "recentlyWatched") {
    // An ongoing series never reaches here — it was refused above. So everything below is a title
    // the app CAN honestly call finished.
    if (isInLibrary) contextualMessage = `This media is in your Library${ratingText}. It will appear in Recently Watched.`;
    else if (isInTopTen) contextualMessage = `This Top 10 media will also appear in Recently Watched.`;
    // NOT an "add" — you already own it and you're already watching it. What this does is FINISH
    // it, and the sentence should be the one the button is actually about.
    else if (isInProgress) contextualMessage = `You're in the middle of this one — adding it here marks it as finished.`;
  } else if (target === "inProgress") {
    if (isInLibrary) contextualMessage = `This media is in your Library. It will be moved to In Progress.`;
    else if (isInTopTen) contextualMessage = `This Top 10 media will be marked In Progress — set where you are.`;
    else if (isInWantToWatch) contextualMessage = `You're starting this one — set which episode you're on.`;
  }

  if (contextualMessage) return allow(contextualMessage);

  // 3. Explicit blocks.
  if (target === "wantToWatch" && isInProgress) {
    return blocked(`This media is "In Progress". You can't move it to Want to Watch.`);
  }
  if (target === "recentlyWatched" && isInWantToWatch) {
    return blocked(`Use the "Mark as watched" button from your Want to Watch list.`);
  }

  // 4. Forbidden combinations. (A plain watched title is `isInLibrary`, which the checks above
  // already catch for its own targets — so the old `isInRecentlyWatched` clauses folded in here.)
  const forbidden =
    (target === "library" && (isInTopTen || isInProgress)) ||
    (target === "wantToWatch" && (isInLibrary || isInTopTen));

  if (forbidden) {
    return blocked(`This transition is not allowed (currently in: ${existingLists.join(", ")}).`);
  }

  // 5. No conflict — clean merge onto the existing entry.
  return allow(null);
}
