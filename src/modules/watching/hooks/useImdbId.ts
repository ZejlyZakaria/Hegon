import { useTitleBundle } from "./useTitleBundle";
import type { TitleBundle } from "../service";
import type { MediaType } from "../types";

// Module-level: a stable `select`, so it never re-derives for nothing.
const selectImdbId = (b: TitleBundle): string | null => b.external_ids?.imdb_id || null;

/**
 * The title's IMDb id (e.g. "tt0816692") — the key OMDb ratings and the episode heatmap wait for.
 *
 * It used to cost its own request, which meant OMDb sat a full round-trip behind a call that
 * carried four bytes of payload. It now arrives with everything else in the shared bundle, so the
 * ratings start the moment the fiche's one TMDB request answers.
 */
export function useImdbId(tmdbId: number, type: MediaType, enabled = true) {
  return useTitleBundle(tmdbId, type, enabled, selectImdbId);
}
