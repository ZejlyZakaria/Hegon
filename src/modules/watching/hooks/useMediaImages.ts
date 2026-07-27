import { useQuery } from "@tanstack/react-query";
import { TMDB_KEYS } from "./query-keys";
import { getMediaImages } from "../service";
import type { MediaType } from "../types";

// Every poster + backdrop TMDB holds for a title — the Images gallery. Same shape as the other TMDB
// reads (long staleTime, keyed under TMDB_KEYS so a library mutation never refetches it).
export function useMediaImages(tmdbId: number, type: MediaType, enabled = true) {
  return useQuery({
    queryKey: TMDB_KEYS.images(type, tmdbId),
    queryFn: () => getMediaImages(tmdbId, type === "film" ? "movie" : "tv"),
    staleTime: 24 * 60 * 60 * 1000, // artwork rarely changes
    gcTime: 60 * 60 * 1000,
    enabled: enabled && !!tmdbId,
  });
}
