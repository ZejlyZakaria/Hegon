"use client";

import { useQuery } from "@tanstack/react-query";
import { getPeopleCounts, getPersonBundle, getTitlesByPerson } from "../service";
import { TMDB_KEYS, WATCHING_KEYS } from "./query-keys";

// Profile + full filmography (one TMDB call). Cached under the TMDB namespace so DB
// mutations never refetch it.
export function usePersonBundle(personId: number) {
  return useQuery({
    queryKey: TMDB_KEYS.person(personId),
    queryFn: () => getPersonBundle(personId),
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    enabled: !!personId,
  });
}

// Your collection titles featuring this person (live DB — reflects adds/removes).
// Matched on the person's credit tmdb_ids ∩ your library (robust to uncredited roles).
export function useTitlesByPerson(userId: string, personId: number, creditTmdbIds: number[]) {
  return useQuery({
    queryKey: WATCHING_KEYS.titlesByPerson(userId, personId),
    queryFn: () => getTitlesByPerson(userId, creditTmdbIds),
    enabled: !!userId && !!personId && creditTmdbIds.length > 0,
  });
}

// Library-wide people frequency — the same answer for every person page, so it's held
// for the session and shared across navigations through the co-star web.
export function usePeopleCounts(userId: string) {
  return useQuery({
    queryKey: WATCHING_KEYS.peopleCounts(userId),
    queryFn: () => getPeopleCounts(userId),
    staleTime: 30 * 60 * 1000,
    enabled: !!userId,
  });
}
