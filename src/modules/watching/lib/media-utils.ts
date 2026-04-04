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
    accentColor: "#0ea5e9",
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
    accentColor: "#f43f5e",
  },
};

// =====================================================
// GENRE COLORS
// =====================================================

export const genreColors: Record<string, string> = {
  "Sci-Fi": "bg-cyan-500/15 text-cyan-400",
  Thriller: "bg-amber-500/15 text-amber-400",
  Noir: "bg-zinc-500/15 text-zinc-300",
  Fantasy: "bg-emerald-500/15 text-emerald-400",
  Adventure: "bg-lime-500/15 text-lime-400",
  Mecha: "bg-red-500/15 text-red-400",
  Action: "bg-orange-500/15 text-orange-400",
  Drama: "bg-blue-500/15 text-blue-400",
  Psychological: "bg-indigo-500/15 text-indigo-400",
  War: "bg-stone-500/15 text-stone-300",
  "Slice of Life": "bg-pink-500/15 text-pink-400",
  Romance: "bg-rose-500/15 text-rose-400",
  Horror: "bg-red-500/15 text-red-400",
  Mystery: "bg-violet-500/15 text-violet-400",
  Crime: "bg-amber-500/15 text-amber-400",
  "Dark Fantasy": "bg-indigo-500/15 text-indigo-400",
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

export function getWatchProgress(currentEpisode?: number, totalEpisodes?: number): number {
  if (!currentEpisode || !totalEpisodes) return 0;
  return Math.round((currentEpisode / totalEpisodes) * 100);
}

export function formatRuntime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hours > 0 ? `${hours}h ${mins}min` : `${mins}min`;
}