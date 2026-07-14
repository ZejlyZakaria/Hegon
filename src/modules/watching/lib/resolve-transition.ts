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
  recently_watched: boolean;
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

export function resolveTransition(
  existing: MediaStateFlags | null,
  target: ListType,
): TransitionResult {
  // No existing entry → clean insert, nothing to warn about.
  if (!existing) {
    return { allowed: true, action: "insert", message: null, existingLists: [] };
  }

  const isInLibrary = existing.watched && !existing.recently_watched && existing.priority == null;
  const isInRecentlyWatched = existing.recently_watched;
  const isInTopTen = existing.priority != null;
  const isInProgress = existing.in_progress;
  const isInWantToWatch = existing.want_to_watch;
  const isPaused = !!existing.paused;
  const isDropped = !!existing.dropped;

  const existingLists: string[] = [];
  if (isInTopTen) existingLists.push("Top 10");
  if (isInProgress) existingLists.push("In Progress");
  if (isPaused) existingLists.push("Paused");
  if (isDropped) existingLists.push("Dropped");
  if (isInWantToWatch) existingLists.push("Want to Watch");
  if (isInRecentlyWatched) existingLists.push("Recently Watched");
  if (isInLibrary) existingLists.push("Library");

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

  // 1. Already in the target list → nothing to do.
  const isAlreadyInTarget =
    (target === "library" && isInLibrary) ||
    (target === "recentlyWatched" && isInRecentlyWatched) ||
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

  /**
   * CAN THE APP HONESTLY SAY YOU FINISHED IT?
   * A film: yes, always — you saw it or you didn't. A series: only once it is OVER. Every sentence
   * below that asserted completion did so purely because of the button you pressed, which is how a
   * modal came to congratulate you on finishing a show whose next episode airs on Sunday.
   * Where the app cannot assert, it describes — and the live "Recorded as …" line under "How far did
   * you get?" says what will actually happen, because it reads your position instead of your intent.
   */
  const canFinish = !existing.type || existing.type === "film" || isFinished(existing.status);

  if (target === "topTen") {
    // RANKING IS NOT WATCHING. It never was — the Top 10 is a favourite and a rank, and asserting
    // "watched" alongside it was the fourth door: it declared a running show finished, silently,
    // for the crime of being loved.
    if (isInLibrary) contextualMessage = `This media is in your Library${ratingText}. It will be added to your Top 10.`;
    else if (isInWantToWatch) contextualMessage = canFinish
      ? `You're marking this as watched AND ranking it in your Top 10.`
      : `You're ranking this in your Top 10 — tell us how far you got.`;
    else if (isInProgress) contextualMessage = canFinish
      ? `You finished this one! It will be ranked in your Top 10.`
      : `It's still airing — your progress is kept, and it will be ranked in your Top 10.`;
    else if (isInRecentlyWatched) contextualMessage = `This recently watched media will be ranked in your Top 10.`;
  } else if (target === "recentlyWatched") {
    if (isInLibrary) contextualMessage = `This media is in your Library${ratingText}. It will appear in Recently Watched.`;
    else if (isInTopTen) contextualMessage = `This Top 10 media will also appear in Recently Watched.`;
    else if (isInProgress) contextualMessage = canFinish
      ? `You finished this one! It will be added to Recently Watched.`
      // Recently Watched means recently FINISHED. This show isn't. Saying otherwise was the lie;
      // saying where it will really land is the truth, and it costs nothing.
      : `Recently Watched is for titles you've finished — this one is still airing, so it stays In Progress.`;
  } else if (target === "inProgress") {
    if (isInLibrary) contextualMessage = `This media is in your Library. It will be moved to In Progress.`;
    else if (isInRecentlyWatched) contextualMessage = `This recently watched media will be marked In Progress — set where you are.`;
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

  // 4. Forbidden combinations.
  const forbidden =
    (target === "library" && (isInRecentlyWatched || isInTopTen || isInProgress)) ||
    (target === "wantToWatch" && (isInLibrary || isInRecentlyWatched || isInTopTen));

  if (forbidden) {
    return blocked(`This transition is not allowed (currently in: ${existingLists.join(", ")}).`);
  }

  // 5. No conflict — clean merge onto the existing entry.
  return allow(null);
}
