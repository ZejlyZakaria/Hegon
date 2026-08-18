/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQuery } from "@tanstack/react-query";
import { TMDB_KEYS } from "./query-keys";
import { getSeasonEpisodes } from "../service";

export interface EpisodeInfo {
  number: number;
  name: string;
  still_url: string | null;
  rating: number | null; // TMDB vote_average
  overview: string;
  air_date: string | null;
}

function mapEpisodes(data: any): EpisodeInfo[] {
  return (data?.episodes ?? []).map((e: any) => ({
    number: e.episode_number,
    name: e.name || `Episode ${e.episode_number}`,
    still_url: e.still_path ? `https://image.tmdb.org/t/p/w300${e.still_path}` : null,
    rating: e.vote_average && e.vote_average > 0 ? e.vote_average : null,
    overview: e.overview ?? "",
    air_date: e.air_date ?? null,
  }));
}

// Episodes of one season (fetched on demand as the season selector changes).
export function useSeasonEpisodes(tmdbId: number, season: number, enabled = true) {
  return useQuery({
    queryKey: TMDB_KEYS.seasonEpisodes(tmdbId, season),
    queryFn: async () => mapEpisodes(await getSeasonEpisodes(tmdbId, season)),
    // 30 min, not 24 h: a freshly-aired episode often lacks its still on TMDB at first fetch, and a
    // day-long staleTime pinned that null for the whole session. A short window lets a later visit
    // pick up the real still once TMDB has it. The 1 h server Data Cache still shields TMDB's quota.
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    enabled: enabled && !!tmdbId && season > 0,
  });
}
