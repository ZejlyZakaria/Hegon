/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQuery } from "@tanstack/react-query";
import { TMDB_KEYS } from "./query-keys";
import { getOmdbData } from "../service";

export interface EpisodeHeatmap {
  // IMDb's own structure — episode count per season (index 0 = season 1). Using
  // IMDb's structure (not TMDB's) fixes anime where seasons differ (One Piece arcs,
  // JJK) and trims the empty tail of un-rated cells.
  seasonEpisodes: number[];
  ratings: Record<number, Record<number, number>>; // season → episode → IMDb rating
}

// Builds the heatmap from OMDb/IMDb: one call for the series (→ totalSeasons), then
// one per season. Only runs when enabled (the modal is open), so a normal fiche
// view never triggers these calls.
export function useEpisodeRatings(imdbId: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: TMDB_KEYS.episodeRatings(imdbId ?? "", 0),
    queryFn: async (): Promise<EpisodeHeatmap> => {
      const series: any = await getOmdbData(imdbId!);
      const totalSeasons = parseInt(series?.totalSeasons, 10) || 0;
      if (!totalSeasons) return { seasonEpisodes: [], ratings: {} };

      const seasons = Array.from({ length: totalSeasons }, (_, i) => i + 1);
      const results = await Promise.all(
        seasons.map((s) => getOmdbData(imdbId!, s).catch(() => null)),
      );

      const seasonEpisodes: number[] = [];
      const ratings: Record<number, Record<number, number>> = {};
      results.forEach((data: any, idx) => {
        const s = idx + 1;
        const eps: any[] = data?.Episodes ?? [];
        seasonEpisodes[idx] = eps.length;
        ratings[s] = {};
        for (const e of eps) {
          const num = parseInt(e.Episode, 10);
          const r = parseFloat(e.imdbRating);
          if (!Number.isNaN(num) && !Number.isNaN(r)) ratings[s][num] = r;
        }
      });
      return { seasonEpisodes, ratings };
    },
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    enabled: enabled && !!imdbId,
  });
}
