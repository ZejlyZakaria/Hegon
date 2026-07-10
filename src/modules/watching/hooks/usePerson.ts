"use client";

import { useQuery } from "@tanstack/react-query";
import { getPersonBundle, getTitlesByPerson } from "../service";
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
export function useTitlesByPerson(userId: string, personId: number) {
  return useQuery({
    queryKey: WATCHING_KEYS.titlesByPerson(userId, personId),
    queryFn: () => getTitlesByPerson(userId, personId),
    enabled: !!userId && !!personId,
  });
}
