// =====================================================
// WATCHING — list transition resolver (pure, testable)
// =====================================================
//
// Single source of truth for "can this media move into the target list, and
// what happens when it does". Consumed by both AddMediaModal (UI conflict
// banner) and useAddMedia (write guard + branch selection) so the two can
// never diverge.

import type { ListType } from "../types";

/** Minimal flag set needed to decide a transition. Both `ExistingMediaEntry`
 *  (modal) and the `getExistingMediaItem` row (mutation) satisfy this. */
export interface MediaStateFlags {
  watched: boolean;
  recently_watched: boolean;
  priority: number | null;
  in_progress: boolean;
  want_to_watch: boolean;
  /** Optional — only used to enrich the (allowed) banner text in the UI.
   *  The write side never reads allowed-message text, so it can omit this. */
  user_rating?: number | null;
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

  const existingLists: string[] = [];
  if (isInTopTen) existingLists.push("Top 10");
  if (isInProgress) existingLists.push("In Progress");
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

  // 2. Contextual (allowed) transitions — friendly amber message.
  const ratingText = existing.user_rating ? ` (rated ${existing.user_rating}/10)` : "";
  let contextualMessage = "";

  if (target === "topTen") {
    if (isInLibrary) contextualMessage = `This media is in your Library${ratingText}. It will be added to your Top 10.`;
    else if (isInWantToWatch) contextualMessage = `You're marking this as watched AND ranking it in your Top 10.`;
    else if (isInProgress) contextualMessage = `You finished this one! It will be ranked in your Top 10.`;
    else if (isInRecentlyWatched) contextualMessage = `This recently watched media will be ranked in your Top 10.`;
  } else if (target === "recentlyWatched") {
    if (isInLibrary) contextualMessage = `This media is in your Library${ratingText}. It will appear in Recently Watched.`;
    else if (isInTopTen) contextualMessage = `This Top 10 media will also appear in Recently Watched.`;
    else if (isInProgress) contextualMessage = `You finished this one! It will be added to Recently Watched.`;
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
