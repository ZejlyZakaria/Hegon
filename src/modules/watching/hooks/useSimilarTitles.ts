/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQuery } from "@tanstack/react-query";
import type { MediaType } from "../types";

async function fetchSimilarTitles(tmdbId: number, type: MediaType): Promise<any[]> {
  const tmdbType = type === "film" ? "movie" : "tv";
  const res = await fetch(
    `/api/tmdb?endpoint=${encodeURIComponent(`${tmdbType}/${tmdbId}/recommendations`)}&language=fr-FR`,
  );
  if (!res.ok) throw new Error("Failed to fetch recommendations");
  const data = await res.json();
  let results: any[] = data.results ?? [];
  if (type === "anime") {
    results = results.filter((r: any) => r.genre_ids?.includes(16));
  }
  return results.slice(0, 6);
}

export function useSimilarTitles(tmdbId: number, type: MediaType, enabled = true) {
  return useQuery({
    queryKey: ["watching", "similar", type, tmdbId] as const,
    queryFn: () => fetchSimilarTitles(tmdbId, type),
    staleTime: 24 * 60 * 60 * 1000, // 24h — reco ne change pas
    gcTime: 60 * 60 * 1000,
    enabled: enabled && !!tmdbId,
  });
}