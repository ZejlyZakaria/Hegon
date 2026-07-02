/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQuery } from "@tanstack/react-query";
import { TMDB_KEYS } from "./query-keys";
import { getReleaseDates, getContentRatings } from "../service";
import type { MediaType } from "../types";

// US certifications (R, PG-13, TV-MA…) are the most globally recognizable, so try
// US first, then GB/FR, then any region that has one.
const CERT_REGIONS = ["US", "GB", "FR"];

function pickMovieCert(results: any[]): string | null {
  const byRegion = new Map<string, any>(results.map((r) => [r.iso_3166_1, r]));
  const certOf = (r: any): string | null =>
    (r?.release_dates ?? []).map((d: any) => d.certification).find((c: string) => c) || null;
  for (const region of CERT_REGIONS) {
    const c = certOf(byRegion.get(region));
    if (c) return c;
  }
  for (const r of results) {
    const c = certOf(r);
    if (c) return c;
  }
  return null;
}

function pickTvCert(results: any[]): string | null {
  const byRegion = new Map<string, any>(results.map((r) => [r.iso_3166_1, r]));
  for (const region of CERT_REGIONS) {
    const c = byRegion.get(region)?.rating;
    if (c) return c;
  }
  for (const r of results) {
    if (r.rating) return r.rating;
  }
  return null;
}

export function useAgeRating(tmdbId: number, type: MediaType, enabled = true) {
  return useQuery({
    queryKey: TMDB_KEYS.ageRating(type, tmdbId),
    queryFn: async () => {
      if (type === "film") {
        const data = await getReleaseDates(tmdbId);
        return pickMovieCert(data?.results ?? []);
      }
      const data = await getContentRatings(tmdbId);
      return pickTvCert(data?.results ?? []);
    },
    staleTime: 7 * 24 * 60 * 60 * 1000, // certifications don't change
    gcTime: 60 * 60 * 1000,
    enabled: enabled && !!tmdbId,
  });
}
