import { useQuery } from "@tanstack/react-query";
import { WATCHING_KEYS } from "./query-keys";
import { getAnimeCours } from "../service";

// The AniList season overlay for one anime (shared reference, keyed by tmdb_id). Cached long: the
// breakdown of Jujutsu Kaisen is the same for everyone and changes only when the resolver job runs.
// The caller decides whether to apply it (source must be 'anilist').
export function useAnimeCours(tmdbId: number, enabled = true) {
  return useQuery({
    queryKey: WATCHING_KEYS.animeCours(tmdbId),
    queryFn: () => getAnimeCours(tmdbId),
    enabled: enabled && !!tmdbId,
    staleTime: 60 * 60 * 1000, // 1h — world facts, not yours
    gcTime: 2 * 60 * 60 * 1000,
  });
}
