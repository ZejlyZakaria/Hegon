import { useQuery } from "@tanstack/react-query";
import { WATCHING_KEYS } from "./query-keys";
import { getOwnedTmdbIds, findOwnedMediaId, findOwnedMediaIds } from "../service";
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

/**
 * Your row for one tmdb_id — how a discover page knows to hand you to your real fiche. Matched by
 * tmdb_id ALONE (see findOwnedMediaId): the type is not part of possession, so a title stored under
 * the "wrong" type is still found and never duplicated. Returns `{ id, type }` (the type actually
 * stored) so the caller can route correctly.
 *
 * Kept under WATCHING_KEYS.all ON PURPOSE: an add invalidates that namespace with refetchType:"all",
 * so this refetches right after you add a title and the redirect fires.
 */
export function useOwnedMediaId(userId: string, tmdbId: number, enabled = true) {
  return useQuery({
    queryKey: [...WATCHING_KEYS.all, "owned-row", tmdbId],
    queryFn: () => findOwnedMediaId(userId, tmdbId),
    staleTime: 2 * 60 * 1000,
    enabled: enabled && !!userId && tmdbId > 0,
  });
}

/**
 * The same answer for a whole list of results, resolved WHILE YOU READ THEM.
 *
 * This is what lets the search route correctly on the first try instead of sending you through a
 * page that exists to tell you you were on the wrong page. It runs as soon as results render, so by
 * the time a click happens the map is already in cache — and if it somehow isn't, the caller falls
 * back to /discover, which still works. Nothing waits on this.
 *
 * Under WATCHING_KEYS.all like its single-row sibling, so adding a title refreshes it and the very
 * next search routes you to the fiche you just created.
 */
export function useOwnedMediaIds(userId: string, tmdbIds: number[]) {
  // Sorted so the same set of results is the same cache entry regardless of TMDB's ordering.
  const key = [...tmdbIds].sort((a, b) => a - b).join(",");
  return useQuery({
    queryKey: [...WATCHING_KEYS.all, "owned-rows", key],
    queryFn: () => findOwnedMediaIds(userId, tmdbIds),
    staleTime: 2 * 60 * 1000,
    enabled: !!userId && tmdbIds.length > 0,
  });
}
