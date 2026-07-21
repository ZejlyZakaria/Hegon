/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback } from "react";
import { useTitleBundle } from "./useTitleBundle";
import type { TitleBundle } from "../service";
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
  // A film certifies through `release_dates`, a show through `content_ratings` — the bundle
  // appends whichever one applies, so the branch that used to pick an ENDPOINT now picks a FIELD.
  const select = useCallback(
    (b: TitleBundle): string | null =>
      type === "film"
        ? pickMovieCert(b.release_dates?.results ?? [])
        : pickTvCert(b.content_ratings?.results ?? []),
    [type],
  );
  return useTitleBundle(tmdbId, type, enabled, select);
}
