// =====================================================
// WATCHING QUERY KEYS
// =====================================================

import type { MediaType, WatchStatus } from "../types";

export const WATCHING_KEYS = {
  all: ['watching'] as const,
  
  // Par type
  movies: () => [...WATCHING_KEYS.all, 'movies'] as const,
  series: () => [...WATCHING_KEYS.all, 'series'] as const,
  animes: () => [...WATCHING_KEYS.all, 'animes'] as const,
  
  // Par statut
  byStatus: (type: MediaType, status: WatchStatus) => 
    [...WATCHING_KEYS.all, type, 'status', status] as const,
  
  // In progress
  inProgress: (type: MediaType) => 
    [...WATCHING_KEYS.all, type, 'in-progress'] as const,
  
  // Recently watched
  recentlyWatched: (type: MediaType) => 
    [...WATCHING_KEYS.all, type, 'recently-watched'] as const,
  
  // Want to watch
  wantToWatch: (type: MediaType) => 
    [...WATCHING_KEYS.all, type, 'want-to-watch'] as const,
  
  // Top rated
  topRated: (type: MediaType) =>
    [...WATCHING_KEYS.all, type, 'top-rated'] as const,

  // tmdb_ids the user owns (per type) — for hiding owned recommendations
  ownedIds: (type: MediaType) =>
    [...WATCHING_KEYS.all, type, 'owned-ids'] as const,

  // Library — all watched media (live client query)
  library: (userId: string) =>
    [...WATCHING_KEYS.all, 'library', userId] as const,
    
  // Detail
  detail: (id: string) =>
    [...WATCHING_KEYS.all, 'detail', id] as const,


  // Stats
  stats: (userId: string) =>
    [...WATCHING_KEYS.all, 'stats', userId] as const,

  // Lists
  lists: (userId: string) =>
    [...WATCHING_KEYS.all, 'lists', userId] as const,
  listsForMedia: (mediaItemId: string) =>
    [...WATCHING_KEYS.all, 'lists-for-media', mediaItemId] as const,
  listItems: (listId: string) =>
    [...WATCHING_KEYS.all, 'list-items', listId] as const,

  // Theme favorites ("My Themes")
  themeFavorites: () =>
    [...WATCHING_KEYS.all, 'theme-favorites'] as const,

  // Rewatches (per media item)
  rewatches: (mediaItemId: string) =>
    [...WATCHING_KEYS.all, 'rewatches', mediaItemId] as const,

  // Your collection titles featuring a person (actor/director)
  titlesByPerson: (userId: string, personId: number) =>
    [...WATCHING_KEYS.all, 'by-person', userId, personId] as const,

  // How many titles you've seen each person in (library-wide) — powers "your #3 actor"
  peopleCounts: (userId: string) =>
    [...WATCHING_KEYS.all, 'people-counts', userId] as const,

  // All your ratings within one type — powers "you rated this higher than 84% of your films"
  ratingsByType: (userId: string, type: MediaType) =>
    [...WATCHING_KEYS.all, 'ratings', userId, type] as const,
} as const;

// =====================================================
// TMDB QUERY KEYS — separate namespace from WATCHING_KEYS.
// DB mutations invalidate WATCHING_KEYS.all (['watching']); keeping
// these expensive external TMDB calls under ['tmdb'] means a favorite
// toggle / rating save / add no longer refetches hero, similar, credits.
// =====================================================

export const TMDB_KEYS = {
  all: ['tmdb'] as const,
  hero: (type: MediaType) =>
    ['tmdb', 'hero', type] as const,
  similar: (type: MediaType, tmdbId: number) =>
    ['tmdb', 'similar', type, tmdbId] as const,
  credits: (type: MediaType, tmdbId: number) =>
    ['tmdb', 'credits', type, tmdbId] as const,
  trailer: (type: MediaType, tmdbId: number) =>
    ['tmdb', 'trailer', type, tmdbId] as const,
  providers: (type: MediaType, tmdbId: number) =>
    ['tmdb', 'providers', type, tmdbId] as const,
  externalIds: (type: MediaType, tmdbId: number) =>
    ['tmdb', 'external-ids', type, tmdbId] as const,
  ageRating: (type: MediaType, tmdbId: number) =>
    ['tmdb', 'age-rating', type, tmdbId] as const,
  omdb: (imdbId: string) =>
    ['omdb', imdbId] as const,
  seasonEpisodes: (tmdbId: number, season: number) =>
    ['tmdb', 'season-episodes', tmdbId, season] as const,
  episodeRatings: (imdbId: string, seasonCount: number) =>
    ['omdb', 'episodes', imdbId, seasonCount] as const,
  forYou: (type: MediaType) =>
    ['tmdb', 'for-you', type] as const,
  person: (personId: number) =>
    ['tmdb', 'person', personId] as const,
} as const;