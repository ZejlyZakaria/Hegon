import type { SeasonPart } from "./season-history";
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


/** Read and write share identity checks, but missing episode evidence does not erase an opinion. */
function scopeIdentityMatches(context:ScopeRatingContext|undefined,view:MediaView,season:number,allowLegacy=false):boolean {
  if(!context || view.pending || context.number!==season || !view.seasons[season-1]) return false;
  if(!view.overlaid) return context.kind==="SEASON";
  if(context.kind!=="COUR") return false;
  const cour=view.cours?.[season-1];
  if(!cour) return false;
  if(context.scope_key===`anilist-cour:${cour.anilist_id}`) {
    return context.range_start===cour.start_episode && context.range_end===cour.end_episode;
  }
  // The server already suppresses legacy fallback when a known identity was remapped.
  // An unbound historical slot may be read as saved, never submitted as verified membership.
  return allowLegacy && context.rating_id===null && context.validity==="SCOPE_UNVERIFIED"
    && context.scope_key===`unverified-cour:${season}` && context.score===view.ratingMap?.[String(season)];
}

/** A stale cour ordinal must never submit an opinion against a different membership. */
export function scopeMatchesView(context:ScopeRatingContext|undefined,view:MediaView,season:number):boolean {
  return scopeIdentityMatches(context,view,season) && context!.available_episodes!=null
    && view.seasons[season-1].airedKnown!==false && context!.available_episodes===view.seasons[season-1].aired;
}

function savedOpinionScore(context:ScopeRatingContext|undefined):number|null {
  return context?.score!=null && context.validity!=="NEEDS_RECONFIRMATION" && context.validity!=="UNRATED" ? context.score:null;
}

/** Displaying a saved score does not confirm or enlarge its recorded episode coverage. */
export function scopeDisplayScore(context:ScopeRatingContext|undefined,view:MediaView,season:number):number|null {
  if(!scopeIdentityMatches(context,view,season,true)) return null;
  const current=view.seasons[season-1];
  if(context!.validity==="CURRENT" && context!.available_episodes!=null && current.airedKnown!==false && context!.available_episodes!==current.aired) return null;
  return savedOpinionScore(context);
}

export function scopeDisplayScores(contexts:ScopeRatingContext[]|undefined,view:MediaView):Record<string,number> {
  const scores:Record<string,number>={};
  for(const context of contexts ?? []) {
    const score=scopeDisplayScore(context,view,context.number);
    if(score!=null) scores[String(context.number)]=score;
  }
  return scores;
}

function partIdentityMatches(context:ScopeRatingContext|undefined,view:MediaView,part:SeasonPart) {
  return !!context && !view.pending && context.kind==="COUR" && context.number===part.scopeNumber
    && context.scope_key===`anilist-cour:${part.id}` && context.range_start===part.flatFrom && context.range_end===part.flatTo
    && view.seasons.some(s=>s.parts?.some(p=>p.id===part.id && p.flatFrom===part.flatFrom && p.flatTo===part.flatTo));
}

function partAvailableEpisodes(view:MediaView,part:SeasonPart):number|null {
  const season=view.seasons.find(s=>s.parts?.some(p=>p.id===part.id));
  return !season || season.airedKnown===false ? null:Math.max(0,Math.min(season.aired,part.to)-part.from+1);
}

/** Same snapshot-bound command as season ratings; the part's stable identity must still match. */
export function partMatchesView(context:ScopeRatingContext|undefined,view:MediaView,part:SeasonPart):boolean {
  return partIdentityMatches(context,view,part) && context!.available_episodes!=null
    && context!.available_episodes===partAvailableEpisodes(view,part);
}

export function partDisplayScore(context:ScopeRatingContext|undefined,view:MediaView,part:SeasonPart):number|null {
  if(!partIdentityMatches(context,view,part)) return null;
  const available=partAvailableEpisodes(view,part);
  if(context!.validity==="CURRENT" && context!.available_episodes!=null && available!=null && context!.available_episodes!==available) return null;
  return savedOpinionScore(context);
}
