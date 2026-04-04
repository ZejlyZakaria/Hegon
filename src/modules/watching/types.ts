// =====================================================
// WATCHING TYPES
// =====================================================

export type MediaType = "film" | "serie" | "anime";

export type WatchStatus = "watching" | "completed" | "plan_to_watch" | "dropped";

export interface WatchingMedia {
  id: string;
  type: MediaType;
  title: string;
  original_title: string;
  description: string | null;
  poster_url: string | null;
  backdrop_url: string | null;
  year: number;
  runtime: number | null;
  episode_runtime?: number;
  seasons?: number;
  episodes?: number;
  current_episode?: number;
  current_season?: number;
  rating: number;
  user_rating: number | null;
  watch_status: WatchStatus;
  favorite: boolean;
  watched_at: string | null;
  priority: number | null;  
  priority_level?: "high" | "medium" | "low"; 
  tmdb_id: number;
  notes: string | null;
  tags: string[];
  directors?: { name: string; profile_url?: string }[];
  studio?: string;
  status?: "ended" | "ongoing";
  
  // Champs booléens (compatibilité avec Supabase)
  watched: boolean;
  in_progress: boolean;
  want_to_watch: boolean;
  recently_watched: boolean;
  
  created_at: string;
  updated_at: string;
  user_id: string;
}

export interface WatchingConfig {
  type: MediaType;
  label: string;
  labelPlural: string;
  tmdbSearchType: "movie" | "tv";
  tmdbTrendingEndpoint: string;
  tmdbNowEndpoint: string;
  tmdbAnimeFilter: boolean;
  hasInProgress: boolean;
  accentColor: string;
}

export interface TMDBMovie {
  id: number;
  title: string;
  original_title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  vote_average: number;
  vote_count: number;
  genre_ids: number[];
  runtime?: number;
}

export interface TMDBTVShow {
  id: number;
  name: string;
  original_name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string;
  vote_average: number;
  vote_count: number;
  genre_ids: number[];
  number_of_seasons?: number;
  number_of_episodes?: number;
  episode_run_time?: number[];
}

export interface TMDBMediaDetails {
  id: number;
  title?: string;
  name?: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average: number;
  runtime?: number;
  episode_run_time?: number[];
  number_of_seasons?: number;
  number_of_episodes?: number;
  genres: { id: number; name: string }[];
  credits?: {
    crew: { job: string; name: string; profile_path?: string }[];
  };
  production_companies?: { name: string }[];
  status?: string;
}