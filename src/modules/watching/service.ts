/* eslint-disable @typescript-eslint/no-explicit-any */

import { createClient } from "@/infrastructure/supabase/client";
import { getCurrentOrgId } from "@/shared/utils/getOrgId";
import type { WatchingMedia, MediaType } from "./types";
import type { UpdateMediaInput } from "./schemas/media.schema";

// =====================================================
// WATCHING SERVICE (SUPABASE)
// =====================================================

export interface GetMediaOptions {
  inProgress?: boolean;
  recentlyWatched?: boolean;
  wantToWatch?: boolean;
  topRated?: boolean;
  watched?: boolean;
  limit?: number;
}

export async function getMediaItems(
  userId: string,
  type: MediaType,
  options: GetMediaOptions = {}
): Promise<WatchingMedia[]> {
  const supabase = createClient();
  let query = supabase
    .schema("watching")
    .from("media_items")
    .select("*")
    .eq("user_id", userId)
    .eq("type", type);

  if (options.inProgress) query = query.eq("in_progress", true);
  if (options.recentlyWatched) query = query.eq("recently_watched", true);
  if (options.wantToWatch) query = query.eq("want_to_watch", true);
  if (options.watched) query = query.eq("watched", true);

  if (options.topRated) {
    query = query
      .eq("favorite", true)
      .not("priority", "is", null)
      .order("priority", { ascending: true });
  } else {
    query = query.order("updated_at", { ascending: false });
  }

  if (options.limit) query = query.limit(options.limit);

  const { data, error } = await query;
  if (error) throw error;
  return (data as WatchingMedia[]) ?? [];
}

export async function getAllWatchedMedia(
  userId: string,
  options: { type?: MediaType; limit?: number } = {}
): Promise<WatchingMedia[]> {
  const supabase = createClient();
  let query = supabase
    .schema("watching")
    .from("media_items")
    .select("*")
    .eq("user_id", userId)
    .eq("watched", true)
    .order("updated_at", { ascending: false });

  if (options.type) query = query.eq("type", options.type);
  if (options.limit) query = query.limit(options.limit);

  const { data, error } = await query;
  if (error) throw error;
  return (data as WatchingMedia[]) ?? [];
}

export async function updateMediaItem(
  id: string,
  updates: Omit<UpdateMediaInput, "id">
): Promise<WatchingMedia> {
  const supabase = createClient();
  const { data, error } = await supabase
    .schema("watching")
    .from("media_items")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as WatchingMedia;
}

export async function deleteMediaItem(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .schema("watching")
    .from("media_items")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function markMediaAsWatched(mediaId: string): Promise<WatchingMedia> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .schema("watching")
    .from("media_items")
    .update({
      watched: true,
      recently_watched: true,
      want_to_watch: false,
      in_progress: false,
      watched_at: new Date().toISOString(),
    })
    .eq("id", mediaId)
    .eq("user_id", user.id)
    .select()
    .single();
  if (error) throw error;
  return data as WatchingMedia;
}

export async function bulkUpdatePriorities(
  items: Array<{ id: string; priority: number }>,
  userId: string
): Promise<void> {
  const supabase = createClient();
  const results = await Promise.all(
    items.map((item) =>
      supabase
        .schema("watching")
        .from("media_items")
        .update({ priority: item.priority })
        .eq("id", item.id)
        .eq("user_id", userId)
    )
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) throw failed.error;
}

export async function getExistingMediaItem(
  userId: string,
  type: MediaType,
  tmdbId: number
) {
  const supabase = createClient();
  const { data } = await supabase
    .schema("watching")
    .from("media_items")
    .select("id, favorite, priority, recently_watched, watched_at, in_progress, want_to_watch, current_episode, current_season")
    .eq("user_id", userId)
    .eq("type", type)
    .eq("tmdb_id", tmdbId)
    .maybeSingle();
  return data;
}

export async function insertMediaItem(data: Record<string, any>): Promise<WatchingMedia> {
  const supabase = createClient();
  const orgId = await getCurrentOrgId();
  const { data: result, error } = await supabase
    .schema("watching")
    .from("media_items")
    .insert({ ...data, org_id: orgId })
    .select()
    .single();
  if (error) throw error;
  return result as WatchingMedia;
}

export async function updateMediaItemById(
  id: string,
  data: Record<string, any>
): Promise<WatchingMedia> {
  const supabase = createClient();
  const { data: result, error } = await supabase
    .schema("watching")
    .from("media_items")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return result as WatchingMedia;
}

export async function getCurrentUserId(): Promise<string> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user.id;
}

// =====================================================
// WATCHING SERVICE (TMDB API)
// =====================================================

const TMDB_BASE = "https://api.themoviedb.org/3";

// =====================================================
// WATCHING SERVICE (TMDB API)
// =====================================================

async function tmdbFetch<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const isServer = typeof window === "undefined";

  if (isServer) {
    const key = process.env.TMDB_API_KEY;
    if (!key) throw new Error("TMDB_API_KEY not set");
    const search = new URLSearchParams({ api_key: key, language: "fr-FR", ...params });
    const res = await fetch(`${TMDB_BASE}/${endpoint}?${search.toString()}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) throw new Error(`TMDB error: ${res.status}`);
    return res.json();
  }

  // client-side → proxy route
  const search = new URLSearchParams({ endpoint, language: "fr-FR", ...params });
  const res = await fetch(`/api/tmdb?${search.toString()}`);
  if (!res.ok) throw new Error(`TMDB fetch failed: ${res.status}`);
  return res.json();
}

// Trending movie of the week (rating > 7, used for hero)
export async function getTrendingMovie() {
  const data = await tmdbFetch<{ results: any[] }>("trending/movie/week");
  return data.results.find((m) => m.vote_average >= 7 && m.vote_count >= 100) ?? data.results[0] ?? null;
}

// Trending tv show of the week
export async function getTrendingTV(extraParams: Record<string, string> = {}) {
  const today = new Date().toISOString().split("T")[0];
  const data = await tmdbFetch<{ results: any[] }>("discover/tv", {
    sort_by: "first_air_date.desc",
    "vote_average.gte": "7",
    "vote_count.gte": "50",
    "first_air_date.lte": today,
    include_adult: "false",
    page: "1",
    ...extraParams,
  });
  return data.results.slice(0, 3);
}

// Search movies or tv
export async function searchTMDB(query: string, type: "movie" | "tv") {
  const data = await tmdbFetch<{ results: any[] }>(`search/${type}`, {
    query: encodeURIComponent(query),
    page: "1",
  });
  return data.results.slice(0, 6);
}

// Movie or tv details with credits
export async function getMediaDetails(id: number, type: "movie" | "tv") {
  return tmdbFetch<any>(`${type}/${id}`, { append_to_response: "credits" });
}

// Genre list
export async function getGenres(type: "movie" | "tv") {
  const data = await tmdbFetch<{ genres: { id: number; name: string }[] }>(`genre/${type}/list`);
  return data.genres;
}

// Hero data (trending + recommendations) — client-side via proxy
export async function getWatchingHeroData(type: MediaType) {
  const trendingEndpoint = type === "film" ? "trending/movie/week" : "discover/tv";
  const trendingParams: Record<string, string> = type === "anime"
    ? { sort_by: "popularity.desc", with_genres: "16", with_origin_country: "JP", "vote_average.gte": "7", "vote_count.gte": "100" }
    : type === "serie"
    ? { sort_by: "popularity.desc", without_genres: "16", "vote_average.gte": "7", "vote_count.gte": "100" }
    : {};

  const recoEndpoint = type === "film" ? "discover/movie" : "discover/tv";
  const recoParams: Record<string, string> = type === "film"
    ? { "vote_average.gte": "7.5", "vote_count.gte": "50", sort_by: "release_date.desc", page: "1" }
    : type === "serie"
    ? { "vote_average.gte": "7.5", "vote_count.gte": "50", sort_by: "first_air_date.desc", without_genres: "16", page: "1" }
    : { "vote_average.gte": "7.5", "vote_count.gte": "50", sort_by: "first_air_date.desc", with_genres: "16", with_origin_country: "JP", page: "1" };

  const [trendingData, recoData] = await Promise.all([
    tmdbFetch<{ results: any[] }>(trendingEndpoint, trendingParams),
    tmdbFetch<{ results: any[] }>(recoEndpoint, recoParams),
  ]);

  const trending = (trendingData.results ?? []).find(
    (m: any) => m.vote_average >= 7 && m.vote_count >= 100
  ) ?? trendingData.results?.[0] ?? null;

  const recommendations = (recoData.results ?? []).slice(0, 8);

  return { trending, recommendations };
}