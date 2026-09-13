import type { MediaType, WatchingConfig } from "../types";

// =====================================================
// WATCHING CONFIGS
// =====================================================

export const WATCHING_CONFIGS: Record<MediaType, WatchingConfig> = {
  film: {
    type: "film",
    label: "film",
    labelPlural: "films",
    tmdbSearchType: "movie",
    tmdbTrendingEndpoint: "trending/movie/week",
    tmdbNowEndpoint: "movie/now_playing",
    tmdbAnimeFilter: false,
    hasInProgress: false,
    accentColor: "#8b5cf6",
  },
  serie: {
    type: "serie",
    label: "série",
    labelPlural: "series",
    tmdbSearchType: "tv",
    tmdbTrendingEndpoint: "trending/tv/week",
    tmdbNowEndpoint: "tv/on_the_air",
    tmdbAnimeFilter: false,
    hasInProgress: true,
    accentColor: "#8b5cf6",
  },
  anime: {
    type: "anime",
    label: "anime",
    labelPlural: "animes",
    tmdbSearchType: "tv",
    tmdbTrendingEndpoint: "discover/tv",
    tmdbNowEndpoint: "discover/tv",
    tmdbAnimeFilter: true,
    hasInProgress: true,
    accentColor: "#8b5cf6",
  },
};

// =====================================================
// TMDB GENRE MAPPING
// =====================================================

export const genreIdToName: Record<number, string> = {
  12: "Adventure",
  14: "Fantasy",
  16: "Animation",
  18: "Drama",
  27: "Horror",
  28: "Action",
  35: "Comedy",
  36: "History",
  37: "Western",
  53: "Thriller",
  80: "Crime",
  99: "Documentary",
  878: "Sci-Fi",
  9648: "Mystery",
  10402: "Music",
  10749: "Romance",
  10751: "Family",
  10752: "War",
  10759: "Action & Adventure",
  10762: "Kids",
  10763: "News",
  10764: "Reality",
  10765: "Sci-Fi & Fantasy",
  10766: "Soap",
  10767: "Talk",
  10768: "War & Politics",
  10770: "TV Movie",
};

export function mapTmdbGenres(genreIds: number[]): string[] {
  return genreIds
    .map((id) => genreIdToName[id])
    .filter(Boolean) as string[];
}

// =====================================================
// WATCH STATUS HELPERS
// =====================================================

