import type { MediaView } from "./media-view";
export type RatingValidity = "CURRENT" | "NEEDS_RECONFIRMATION" | "SCOPE_UNVERIFIED" | "UNRATED";
export type RatingAction = "INITIAL" | "CONFIRM" | "REVISE" | "CORRECTION";
export interface ScopeRatingContext {
  kind: "SEASON" | "COUR";
  number: number;
  scope_key: string;
  rating_id: string | null;
  score: number | null;
  validity: RatingValidity;
  covered_episodes: number | null;
  provider_snapshot_id: string | null;
  mapping_snapshot_id: string | null;
  available_episodes: number | null;
  range_start: number | null;
  range_end: number | null;
}
/** Membership, not mutable episode counts or progress, determines validity. */
export function ratingValidity(score: number | null, covered: readonly number[] | null, accepted: readonly number[] | null): RatingValidity {
  if (score == null) return "UNRATED";
  if (!covered?.length || !accepted?.length) return "SCOPE_UNVERIFIED";
  const current = new Set(accepted), old = new Set(covered);
  if (covered.some((id) => !current.has(id))) return "SCOPE_UNVERIFIED";
  return accepted.some((id) => !old.has(id)) ? "NEEDS_RECONFIRMATION" : "CURRENT";
}
export function ratingAction(previous: ScopeRatingContext | undefined, score: number | null): RatingAction {
  if (score == null) return "CORRECTION";
  if (!previous?.rating_id) return "INITIAL";
  return previous.score === score ? "CONFIRM" : "REVISE";
}


/** A stale cour ordinal must never submit an opinion against a different membership. */
export function scopeMatchesView(context: ScopeRatingContext | undefined, view: MediaView, season: number): boolean {
  if (!context || view.pending || context.number !== season) return false;
  if (context.available_episodes != null && context.available_episodes !== view.seasons[season-1]?.aired) return false;
  if (!view.overlaid) return context.kind === "SEASON";
  const cour = view.cours?.[season-1];
  return !!cour && context.kind === "COUR" && context.scope_key === `anilist-cour:${cour.anilist_id}`
    && context.range_start === cour.start_episode && context.range_end === cour.end_episode;
}

export function scopeDisplayScores(contexts: ScopeRatingContext[] | undefined, view: MediaView): Record<string, number> {
  const scores: Record<string, number> = {};
  for (const context of contexts ?? []) {
    if (context.score != null && scopeMatchesView(context, view, context.number)) scores[String(context.number)] = context.score;
  }
  return scores;
}
