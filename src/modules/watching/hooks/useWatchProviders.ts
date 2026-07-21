/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback } from "react";
import { useTitleBundle } from "./useTitleBundle";
import { PROVIDER_REGIONS, type TitleBundle } from "../service";
import type { MediaType } from "../types";

export interface WatchProvider {
  id: number;
  name: string;
  logo_url: string | null;
}

export interface WatchProviderInfo {
  region: string;
  link: string | null;
  flatrate: WatchProvider[];
}

// Preferred region order — see PROVIDER_REGIONS for why it is Morocco, then France, then the US.
// Passing `preferred` (a user-chosen region) makes a region picker trivial: resolution already
// supports it, and the order is the only thing a picker would override. That matters here, because
// the owner splits his time between two of these countries and a fixed order can only guess.
//
// ⚠️ SHARED WITH THE PROXY, which trims the payload to exactly these regions (plus one fallback if
// none of them carries anything). A `preferred` region outside this list resolves to nothing — not
// because the title is unavailable there, but because the server never sent it. Add it to
// PROVIDER_REGIONS the day a picker ships.
const FALLBACK_REGIONS = [...PROVIDER_REGIONS];

function mapProviders(list: any[]): WatchProvider[] {
  return (list ?? [])
    .slice()
    .sort((a, b) => (a.display_priority ?? 99) - (b.display_priority ?? 99))
    .map((p) => ({
      id: p.provider_id,
      name: p.provider_name,
      logo_url: p.logo_path ? `https://image.tmdb.org/t/p/w92${p.logo_path}` : null,
    }));
}

function resolve(results: any, preferred?: string): WatchProviderInfo | null {
  if (!results) return null;
  const order = preferred ? [preferred, ...FALLBACK_REGIONS] : FALLBACK_REGIONS;
  const pick =
    order.find((r) => results[r]?.flatrate?.length) ??
    Object.keys(results).find((r) => results[r]?.flatrate?.length);
  if (!pick) return null;
  return {
    region: pick,
    link: results[pick].link ?? null,
    flatrate: mapProviders(results[pick].flatrate),
  };
}

export function useWatchProviders(
  tmdbId: number,
  type: MediaType,
  enabled = true,
  preferredRegion?: string,
) {
  /**
   * The region no longer belongs in the CACHE KEY, and that is a small win of its own: TMDB returns
   * every country in one payload, so choosing a region is a pure read over data we already hold.
   * Keying by region meant switching it refetched an identical response.
   */
  const select = useCallback(
    (b: TitleBundle): WatchProviderInfo | null =>
      resolve(b["watch/providers"]?.results, preferredRegion),
    [preferredRegion],
  );
  return useTitleBundle(tmdbId, type, enabled, select);
}
