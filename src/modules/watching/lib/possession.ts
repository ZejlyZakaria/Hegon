import type { MediaType } from "../types";

/** The shape of a row the possession lookup returns — just enough to route to it. */
export interface OwnedRow {
  id: string;
  type: MediaType;
}

/** tmdb_id → the row you own for it. Empty until the batched lookup lands. */
export type OwnedMap = Record<number, OwnedRow>;

/** What a search result must carry for this rule to apply: its id, and TMDB's own kind. */
export interface CatalogueResult {
  id: number;
  media_type?: string | null;
}

/**
 * DO YOU OWN THIS SEARCH RESULT?
 *
 * ⚠️ TMDB REUSES ITS NUMBERS ACROSS MOVIES AND SHOWS — id 1399 is a film *and* a series. Possession
 * is looked up on tmdb_id ALONE, and that is deliberate: our own film/serie/anime type is GUESSED
 * from genres and country (`tmdbResultType`), and trusting that guess is what once let a second row
 * of the same show be created. Two authorities for one fact, so we removed one.
 *
 * That is safe when the question is asked about a single title on a page whose kind is already
 * known. It is NOT safe for a mixed list of search results, where a film would be marked "In your
 * library" — and route you to a fiche — because you happen to own an unrelated series sharing the
 * number. The batching is what made this reachable; the rule is what makes it correct.
 *
 * So we compare the one thing that is not a guess: TMDB's own `media_type` on the result itself.
 * movie ↔ film · tv ↔ serie|anime. That keeps the two namespaces apart without re-introducing the
 * guess *within* them — an anime stored as "serie" still matches a tv result, which is the whole
 * point of not filtering on our type.
 *
 * Anything that isn't a movie or a tv result (TMDB also returns people) owns nothing.
 */
export function ownedRowFor(r: CatalogueResult, owned: OwnedMap): OwnedRow | null {
  const mine = owned[r.id];
  if (!mine) return null;
  if (r.media_type === "movie") return mine.type === "film" ? mine : null;
  if (r.media_type === "tv") return mine.type !== "film" ? mine : null;
  return null;
}
