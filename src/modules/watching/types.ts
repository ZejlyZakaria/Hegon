// =====================================================
// WATCHING TYPES
// =====================================================

export type MediaType = "film" | "serie" | "anime";

export type WatchStatus = "watching" | "completed" | "plan_to_watch" | "paused" | "dropped" | "reference";

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
  /** Episodes ACTUALLY AIRED per season. The only source of truth for progress. */
  season_aired?: number[] | null;
  /** When you last saw everything that had aired. Non-null = you were caught up once. */
  caught_up_at?: string | null;
  last_synced_at?: string | null;
  /** When you last moved FORWARD through this title. Null = never captured. */
  last_watched_at?: string | null;
  season_posters?: (string | null)[] | null;   // TMDB poster_path per season (season-1 indexed)
  season_air_dates?: (string | null)[] | null;  // TMDB air_date per season (season-1 indexed)
  /**
   * Air date of the LAST AIRED episode of each season — null while a season is still coming out.
   * This, not the START date, is the earliest you could have finished a season: one that premiered
   * in December and ended in February was not watchable "from December" in any useful sense.
   * Filled by the series sync.
   */
  season_end_dates?: (string | null)[] | null;
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
  // Stamped by a DB trigger, and ONLY when `notes` changes — `updated_at` moves on any
  // status/progress edit, so it could never date a review.
  note_updated_at?: string | null;
  tags: string[];
  directors?: { id?: number; name: string; profile_url?: string }[];
  // Cast cached from TMDB (top ~12) so the detail page renders Cast & Crew from
  // the DB with no extra TMDB call. Matches CastMember from useMediaCredits.
  cast_members?: { id: number; name: string; character: string | null; profile_url: string | null }[];
  studio?: string;
  /** TMDB, normalised. "canceled" is FINISHED — no episode is ever coming. */
  status?: "ended" | "ongoing" | "canceled";
  
  // Champs booléens (compatibilité avec Supabase)
  watched: boolean;
  in_progress: boolean;
  want_to_watch: boolean;
  dropped: boolean;
  drop_reason?: string | null;
  paused: boolean;
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
  rating: number | null;    // per-episode user rating 0-10 (null = unrated)
  highlighted: boolean;     // "best episode" flag (distinct from rating)
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
  /** Soft delete. Non-null = hidden, not destroyed — its titles are still there. */
  deleted_at?: string | null;
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
  /** /movie/{id} & /tv/{id} return objects here, not the ids /search returns. */
  genres?: { id: number; name: string }[];
  runtime?: number;
  episode_run_time?: number[];
  number_of_seasons?: number;
  number_of_episodes?: number;
  seasons?: { season_number: number; episode_count: number }[];
  credits?: {
    crew: { id: number; job: string; name: string; profile_path?: string }[];
    cast?: { id: number; name: string; character?: string; profile_path?: string | null }[];
  };
  aggregate_credits?: {
    cast?: { id: number; name: string; roles?: { character?: string }[]; profile_path?: string | null }[];
  };
  created_by?: { id: number; name: string; profile_path?: string | null }[];
  production_companies?: { name: string }[];
  networks?: { name: string }[];
  status?: string;
  /** TMDB's own answer to "what is the newest episode that EXISTS". Free airing data. */
  last_episode_to_air?: { runtime?: number; season_number?: number; episode_number?: number };
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
    crew: { id: number; job: string; name: string; profile_path?: string }[];
  };
  production_companies?: { name: string }[];
  status?: string;
}

// ── Theme favorites ("My Themes") ──
export interface ThemeFavorite {
  id: string;
  track_key: string;
  anime_name: string;
  label: string;
  title: string;
  artist: string;
  audio_url: string | null;
  video_url: string | null;
  cover: string | null;
  anime_poster: string | null;
  media_tmdb_id: number | null;
  created_at: string;
}

// ── Rewatches ──
export interface Rewatch {
  id: string;
  media_item_id: string;
  watched_on: string;  // 'YYYY-MM-DD'
  created_at: string;
}

// Structural input for hearting a track (a PlayerTrack satisfies this).
export interface ThemeFavoriteInput {
  animeName: string;
  label: string;
  title: string;
  artist: string;
  audioUrl: string | null;
  videoUrl: string | null;
  cover: string | null;
  animePoster: string | null;
}