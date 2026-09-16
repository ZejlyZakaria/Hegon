import { useQuery } from "@tanstack/react-query";
import { STALE } from "@/shared/lib/stale";
import { AWARD_KEYS } from "./query-keys";
import {
  getAwardCategories,
  getAwardCeremonies,
  getAwardWinners,
  getAwardCategoryRows,
  getAwardYearRows,
  getAwardsForWork,
  getAwardsForPerson,
  getOwnedTitles,
} from "../service";
import type { AwardCeremony } from "../types";

// The canon changes once a year (a ceremony) and the robot refreshes it monthly: a day is the
// longest tier under that cadence. Reference data, so every key declares its gcTime (R4).

export function useAwardCategories() {
  return useQuery({
    queryKey: AWARD_KEYS.categories(),
    queryFn: getAwardCategories,
    staleTime: STALE.DAY,
    gcTime: STALE.DAY,
  });
}

export function useAwardCeremonies() {
  return useQuery({
    queryKey: AWARD_KEYS.ceremonies(),
    queryFn: getAwardCeremonies,
    staleTime: STALE.DAY,
    gcTime: STALE.DAY,
  });
}

export function useAwardWinners(ceremony: AwardCeremony) {
  return useQuery({
    queryKey: AWARD_KEYS.winners(ceremony),
    queryFn: () => getAwardWinners(ceremony),
    staleTime: STALE.DAY,
    gcTime: STALE.DAY,
  });
}

export function useAwardCategoryRows(ceremony: AwardCeremony, category: string) {
  return useQuery({
    queryKey: AWARD_KEYS.category(ceremony, category),
    queryFn: () => getAwardCategoryRows(ceremony, category),
    staleTime: STALE.DAY,
    gcTime: STALE.DAY,
    enabled: !!category,
  });
}

export function useAwardYear(ceremony: AwardCeremony, year: number) {
  return useQuery({
    queryKey: AWARD_KEYS.year(ceremony, year),
    queryFn: () => getAwardYearRows(ceremony, year),
    staleTime: STALE.DAY,
    gcTime: STALE.DAY,
    enabled: year > 1900,
  });
}

export function useAwardsForWork(type: "film" | "serie", tmdbId: number | null, enabled = true) {
  return useQuery({
    queryKey: AWARD_KEYS.work(type, tmdbId ?? 0),
    queryFn: () => getAwardsForWork(type, tmdbId!),
    staleTime: STALE.DAY,
    gcTime: STALE.DAY,
    enabled: enabled && !!tmdbId,
  });
}

export function useAwardsForPerson(personTmdbId: number | null) {
  return useQuery({
    queryKey: AWARD_KEYS.person(personTmdbId ?? 0),
    queryFn: () => getAwardsForPerson(personTmdbId!),
    staleTime: STALE.DAY,
    gcTime: STALE.DAY,
    enabled: !!personTmdbId,
  });
}

/** Your library, as the canon sees it — under WATCHING_KEYS so an add lights the title up. */
export function useOwnedTitles(userId: string | null) {
  return useQuery({
    queryKey: AWARD_KEYS.owned(),
    queryFn: () => getOwnedTitles(userId!),
    staleTime: STALE.TWO_MINUTES,
    enabled: !!userId,
  });
}
