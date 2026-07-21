import { useQuery } from "@tanstack/react-query";
import { TMDB_KEYS } from "./query-keys";
import { getTitleBundle, type TitleBundle } from "../service";
import type { MediaType } from "../types";

/**
 * THE SHARED FETCH THAT MAKES THE OTHER HOOKS FREE.
 *
 * Six hooks used to ask TMDB six questions about the same title, each with its own request, its own
 * key and its own cache entry. They now all subscribe HERE, with the same key and a different
 * `select` — so React Query issues exactly one request and hands each caller its slice. Sharing is
 * a property of the key, not of anyone remembering to coordinate.
 *
 * Each hook keeps its old signature and its old return shape, so no call site changed. What changed
 * is that opening a fiche costs one round-trip instead of five, and OMDb no longer waits behind a
 * request whose only purpose was to hand it an imdb_id.
 *
 * `select` runs on every render, so callers pass a STABLE function (module constant or useCallback).
 * An inline arrow would re-derive — and re-render — for nothing.
 */
export function useTitleBundle<T>(
  tmdbId: number,
  type: MediaType,
  enabled: boolean,
  select: (bundle: TitleBundle) => T,
) {
  return useQuery({
    queryKey: TMDB_KEYS.bundle(type, tmdbId),
    queryFn: () => getTitleBundle(tmdbId, type === "film" ? "movie" : "tv"),
    select,
    // The longest-lived facts here (ids, certifications) never change; the shortest (providers)
    // shift slowly. One day covers all of them, and a stale bundle still renders instantly while
    // it refreshes underneath.
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    enabled: enabled && !!tmdbId,
  });
}
