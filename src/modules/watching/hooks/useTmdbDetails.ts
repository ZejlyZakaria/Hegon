import { useQuery } from "@tanstack/react-query";
import { getTmdbDetails } from "../service";
import { TMDB_KEYS } from "./query-keys";
import type { MediaType } from "../types";

/**
 * The world's facts about a title you do NOT own, shaped as a media row so the detail
 * components render it unchanged. Cached for an hour: a film's runtime, genres and cast do not
 * move, and browsing search results should not re-ask TMDB the same question every time you
 * step back and forth.
 */
export function useTmdbDetails(tmdbId: number, type: MediaType, enabled = true) {
  return useQuery({
    queryKey: TMDB_KEYS.details(type, tmdbId),
    queryFn: () => getTmdbDetails(tmdbId, type),
    enabled: enabled && tmdbId > 0,
    staleTime: 60 * 60 * 1000,
  });
}
