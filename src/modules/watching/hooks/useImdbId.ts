import { useQuery } from "@tanstack/react-query";
import { TMDB_KEYS } from "./query-keys";
import { getExternalIds } from "../service";
import type { MediaType } from "../types";

// The title's IMDb id (e.g. "tt0816692"). Shared by the IMDb link + (later) OMDb
// ratings and the episode heatmap — React Query dedupes the fetch across them.
export function useImdbId(tmdbId: number, type: MediaType, enabled = true) {
  return useQuery({
    queryKey: TMDB_KEYS.externalIds(type, tmdbId),
    queryFn: async () => {
      const tmdbType = type === "film" ? "movie" : "tv";
      const data = await getExternalIds(tmdbId, tmdbType);
      return (data?.imdb_id as string) || null;
    },
    staleTime: 7 * 24 * 60 * 60 * 1000, // ids never change
    gcTime: 60 * 60 * 1000,
    enabled: enabled && !!tmdbId,
  });
}
