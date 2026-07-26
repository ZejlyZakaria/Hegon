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
  /** FILM only — TMDB release date ('YYYY-MM-DD'). The truth behind the derived "Waiting for" rail:
   *  release_date in the future = not out yet. Null for series/anime and legacy rows. */
  release_date?: string | null;
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
  // Anime v2 — per-COUR year/rating (keyed by cour number), for AniList-overlaid anime. Distinct
  // from season_years/season_ratings (TMDB seasons, read by Stats).
  cour_years?: Record<string, number> | null;
  cour_ratings?: Record<string, number> | null;
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

// ── Anime v2 — AniList season overlay ──
// One real season (cour) of an anime TMDB lumps into a single flat season. `start_episode`/
// `end_episode` are TMDB FLAT episode numbers (S2 of Jujutsu = ep 25-47). `poster_url` is an
// absolute AniList URL. `episodes`/`end_episode` are null while a season is still airing.
export interface AnimeCour {
  season: number;
  anilist_id: number;
  title: string;
  poster_url: string | null;
  year: number | null;       // START year (what the season "is" — e.g. a 2023 cour)
  end_year: number | null;   // year the cour FINISHED airing — floors "year watched" (a cour that
                             // ran Oct 2023→Mar 2024 could not have been finished before 2024)
  episodes: number | null;
  start_episode: number;
  end_episode: number | null;
}

export interface AnimeCoursRow {
  tmdb_id: number;
  cours: AnimeCour[];
  source: "anilist" | "mismatch" | "none";
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