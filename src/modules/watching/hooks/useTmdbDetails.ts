import { useCallback } from "react";
import { useTitleBundle } from "./useTitleBundle";
import { mapTmdbDetails, type TitleBundle } from "../service";
import type { MediaType, WatchingMedia } from "../types";

/**
 * The world's facts about a title you do NOT own, shaped as a media row so the detail components
 * render it unchanged.
 *
 * It used to fetch `{type}/{id}` on its own — and the bundle IS that record, with the trailer, the
 * certifications and the recommendations appended. So the discover page asked TMDB for the same
 * resource twice in the same breath: once bare here, once with extras. Now it reads the shared
 * response, and one request feeds the hero, the details panel, the trailer button, the age rating
 * and More Like This.
 */
export function useTmdbDetails(tmdbId: number, type: MediaType, enabled = true) {
  const select = useCallback(
    (b: TitleBundle): WatchingMedia | null => mapTmdbDetails(b, tmdbId, type),
    [tmdbId, type],
  );
  return useTitleBundle(tmdbId, type, enabled, select);
}
