import { useQuery } from "@tanstack/react-query";
import { WATCHING_KEYS } from "./query-keys";
import { getOwnedTmdbIds, findOwnedMediaId } from "../service";
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
