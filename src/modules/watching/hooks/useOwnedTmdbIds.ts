import { useQuery } from "@tanstack/react-query";
import { WATCHING_KEYS } from "./query-keys";
import { getOwnedTmdbIds } from "../service";
import type { MediaType } from "../types";

// The set of tmdb_ids the user already owns for a given type. Tiny, indexed query
// (ids only) — runs in parallel with the detail page's other fetches, so it does
// not slow the page. Used to hide already-owned titles from "More Like This".
export function useOwnedTmdbIds(userId: string, type: MediaType, enabled = true) {
  return useQuery({
    queryKey: WATCHING_KEYS.ownedIds(type),
    queryFn: () => getOwnedTmdbIds(userId, type),
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    enabled: enabled && !!userId,
  });
}
