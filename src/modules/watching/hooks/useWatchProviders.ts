/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQuery } from "@tanstack/react-query";
import { TMDB_KEYS } from "./query-keys";
import { getWatchProviders } from "../service";
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

// Preferred region order — owner is in Morocco; fall back to data-rich regions so
// the block is never empty when providers exist somewhere. Passing `preferred`
// (a user-chosen region) makes Option C trivial — resolution already supports it.
const FALLBACK_REGIONS = ["MA", "FR", "US", "GB"];

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
  return useQuery({
    queryKey: [...TMDB_KEYS.providers(type, tmdbId), preferredRegion ?? "auto"],
    queryFn: async () => {
      const tmdbType = type === "film" ? "movie" : "tv";
      const data = await getWatchProviders(tmdbId, tmdbType);
      return resolve(data?.results, preferredRegion);
    },
    staleTime: 24 * 60 * 60 * 1000, // availability shifts slowly
    gcTime: 60 * 60 * 1000,
    enabled: enabled && !!tmdbId,
  });
}
