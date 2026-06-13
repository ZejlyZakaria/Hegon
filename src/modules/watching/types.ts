// =====================================================
// WATCHING TYPES
// =====================================================

export type MediaType = "film" | "serie" | "anime";

export type WatchStatus = "watching" | "completed" | "plan_to_watch" | "dropped" | "reference";

/** The five "lists" a media item can be added to from AddMediaModal. */
export type ListType =
  | "topTen"
  | "inProgress"
  | "recentlyWatched"
  | "wantToWatch"
  | "library";

export interface WatchingMedia {
  org_id: string;
  id: string;
  type: MediaType;
  title: string;
  original_title: string | null;
  description: string | null;
  poster_url: string | null;
  backdrop_url: string | null;
  year: number;
  runtime: number | null;
  episode_runtime?: number;
  seasons?: number;
  episodes?: number;
  season_episodes?: number[] | null;
  season_posters?: (string | null)[] | null;   // TMDB poster_path per season (season-1 indexed)
  season_air_dates?: (string | null)[] | null;  // TMDB air_date per season (season-1 indexed)
  current_episode?: number;
  current_season?: number;
  season_years?: Record<string, number> | null;    // { "<season>": <year watched> }
  season_ratings?: Record<string, number> | null;  // { "<season>": <rating 1–10> }
  rating: number;
  user_rating: number | null;
  watch_status?: WatchStatus;
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
  is_reference?: boolean;
  
  created_at: string;
  updated_at: string;
  user_id: string;
}

export interface EpisodeHighlight {
  id: string;
  media_item_id: string;
  user_id: string;
  season: number;
  episode: number;
  title: string | null;
  still_path: string | null;
  note: string | null;
  created_at: string;
}

export interface MediaList {
  id: string;
  user_id: string;
  org_id: string;
  name: string;
  description: string | null;
  emoji: string | null;
  color: string | null;
  is_ranked: boolean;
  created_at: string;
  updated_at: string;
}

export interface MediaListItemWithMedia {
  list_item_id: string;
  position: number;
  note: string | null;
  added_at: string;
  media: WatchingMedia;
}

export interface MediaListItem {
  id: string;
  list_id: string;
  media_item_id: string;
  user_id: string;
  org_id: string;
  position: number;
  note: string | null;
  added_at: string;
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

// TMDB search result (search/movie or search/tv endpoint) + merged detail fields
export interface TmdbModalResult {
  id: number;
  media_type?: "movie" | "tv";
  // search fields
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average: number;
  genre_ids: number[];
  origin_country?: string[];
  // detail fields (populated after selectResult fetch)
  runtime?: number;
  episode_run_time?: number[];
  number_of_seasons?: number;
  number_of_episodes?: number;
  seasons?: { season_number: number; episode_count: number }[];
  credits?: { crew: { job: string; name: string; profile_path?: string }[] };
  created_by?: { name: string; profile_path?: string | null }[];
  production_companies?: { name: string }[];
  networks?: { name: string }[];
  status?: string;
  last_episode_to_air?: { runtime?: number };
}

export interface TmdbListResult {
  id: number;
  media_type: "movie" | "tv";
  title: string;
  original_title: string | null;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string | null;
  first_air_date: string | null;
  vote_average: number;
  overview: string;
  genre_ids: number[];
  origin_country: string[];
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