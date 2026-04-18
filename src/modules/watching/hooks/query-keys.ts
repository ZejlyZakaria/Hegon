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
  
  // Library (tout)
  library: (userId: string) => 
    [...WATCHING_KEYS.all, 'library', userId] as const,
  
  // Recently watched
  recentlyWatched: (type: MediaType) => 
    [...WATCHING_KEYS.all, type, 'recently-watched'] as const,
  
  // Want to watch
  wantToWatch: (type: MediaType) => 
    [...WATCHING_KEYS.all, type, 'want-to-watch'] as const,
  
  // Top rated
  topRated: (type: MediaType) => 
    [...WATCHING_KEYS.all, type, 'top-rated'] as const,
    
  // Detail
  detail: (id: string) =>
    [...WATCHING_KEYS.all, 'detail', id] as const,

  // Hero (TMDB trending + recommendations)
  hero: (type: MediaType) =>
    [...WATCHING_KEYS.all, 'hero', type] as const,
} as const;