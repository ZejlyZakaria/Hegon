/* eslint-disable @typescript-eslint/no-explicit-any */

import { createClient } from "@/infrastructure/supabase/client";
import { getCurrentOrgId } from "@/shared/utils/getOrgId";
import type { WatchingMedia, MediaType, WatchStatus, EpisodeHighlight, MediaList, MediaListItem, MediaListItemWithMedia } from "./types";
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

  // Default safety limit: a user with 500+ films would otherwise fetch everything.
  // Library view should opt-in to a higher limit explicitly. Audit §3.5.
  query = query.limit(options.limit ?? 100);

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

export async function getMediaItemById(id: string): Promise<WatchingMedia | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .schema("watching")
    .from("media_items")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as WatchingMedia | null;
}

export async function getCurrentUserId(): Promise<string> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user.id;
}

// =====================================================
// MEDIA LISTS (Supabase)
// =====================================================

export async function getMediaLists(userId: string): Promise<MediaList[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .schema("watching")
    .from("media_lists")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as MediaList[];
}

export async function getListsForMedia(mediaItemId: string): Promise<MediaList[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .schema("watching")
    .from("media_list_items")
    .select("list_id, media_lists(*)")
    .eq("media_item_id", mediaItemId);
  if (error) throw error;
  return (data ?? []).map((d: any) => d.media_lists).filter(Boolean) as MediaList[];
}

export async function createMediaList(name: string, userId: string): Promise<MediaList> {
  const supabase = createClient();
  const orgId = await getCurrentOrgId();
  const { data, error } = await supabase
    .schema("watching")
    .from("media_lists")
    .insert({ name, user_id: userId, org_id: orgId })
    .select()
    .single();
  if (error) throw error;
  return data as MediaList;
}

export async function addMediaToList(listId: string, mediaItemId: string, userId: string): Promise<MediaListItem> {
  const supabase = createClient();
  const orgId = await getCurrentOrgId();
  const { data: maxData } = await supabase
    .schema("watching")
    .from("media_list_items")
    .select("position")
    .eq("list_id", listId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const position = ((maxData as any)?.position ?? 0) + 1;
  const { data, error } = await supabase
    .schema("watching")
    .from("media_list_items")
    .insert({ list_id: listId, media_item_id: mediaItemId, user_id: userId, org_id: orgId, position })
    .select()
    .single();
  if (error) throw error;
  await supabase
    .schema("watching")
    .from("media_lists")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", listId);
  return data as MediaListItem;
}

export async function removeMediaFromList(listId: string, mediaItemId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .schema("watching")
    .from("media_list_items")
    .delete()
    .eq("list_id", listId)
    .eq("media_item_id", mediaItemId);
  if (error) throw error;
  await supabase
    .schema("watching")
    .from("media_lists")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", listId);
}

export async function deleteMediaList(listId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .schema("watching")
    .from("media_lists")
    .delete()
    .eq("id", listId);
  if (error) throw error;
}

// =====================================================
// FOR YOU — TMDB RECOMMENDATIONS BASED ON FAVORITES
// =====================================================

const WATCHED_THRESHOLD: Record<MediaType, number> = { film: 50, serie: 10, anime: 10 };

export interface ForYouItem {
  id: number;
  title: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  year: string;
  overview: string;
  genre_ids: number[];
}

export async function getForYouRecommendations(
  userId: string,
  type: MediaType
): Promise<ForYouItem[]> {
  const supabase = createClient();
  const tmdbType = type === "film" ? "movie" : "tv";

  const [favoritesRes, existingRes, watchedRes] = await Promise.all([
    supabase.schema("watching").from("media_items")
      .select("tmdb_id, user_rating")
      .eq("user_id", userId).eq("type", type).eq("favorite", true)
      .not("user_rating", "is", null)
      .order("user_rating", { ascending: false })
      .limit(5),
    supabase.schema("watching").from("media_items")
      .select("tmdb_id")
      .eq("user_id", userId).eq("type", type),
    supabase.schema("watching").from("media_items")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId).eq("type", type).eq("watched", true),
  ]);

  if (favoritesRes.error) throw favoritesRes.error;
  if (existingRes.error) throw existingRes.error;

  const favorites = (favoritesRes.data ?? []) as { tmdb_id: number; user_rating: number }[];
  const watchedCount = watchedRes.count ?? 0;

  if (favorites.length === 0 || watchedCount < WATCHED_THRESHOLD[type]) return [];

  const existingIds = new Set((existingRes.data ?? []).map((i: any) => i.tmdb_id));

  // 1 fixed (#1 rated) + up to 2 deterministic from the rest — rotates daily, stable across reloads
  const seeds: number[] = [favorites[0].tmdb_id];
  const pool = favorites.slice(1);
  if (pool.length > 0) {
    const dayIndex = Math.floor(Date.now() / 86_400_000);
    const idx1 = dayIndex % pool.length;
    const idx2 = (dayIndex + 1) % pool.length;
    seeds.push(pool[idx1].tmdb_id);
    if (idx2 !== idx1) seeds.push(pool[idx2].tmdb_id);
  }

  const recoResults = await Promise.all(
    seeds.map((tmdbId) =>
      tmdbFetch<{ results: any[] }>(`${tmdbType}/${tmdbId}/recommendations`, { page: "1" })
        .then((d) => d.results ?? [])
        .catch(() => [])
    )
  );

  const MIN_VOTE_AVERAGE = 7.0;
  const MIN_VOTE_COUNT = type === "film" ? 200 : 50;

  const seen = new Set<number>();
  const candidates: ForYouItem[] = [];

  for (const batch of recoResults) {
    for (const item of batch) {
      if (seen.has(item.id) || existingIds.has(item.id)) continue;
      if ((item.vote_average ?? 0) < MIN_VOTE_AVERAGE) continue;
      if ((item.vote_count ?? 0) < MIN_VOTE_COUNT) continue;
      seen.add(item.id);
      candidates.push({
        id: item.id,
        title: item.title ?? item.name ?? "",
        poster_path: item.poster_path ?? null,
        backdrop_path: item.backdrop_path ?? null,
        vote_average: item.vote_average ?? 0,
        year: (item.release_date ?? item.first_air_date ?? "").slice(0, 4),
        overview: item.overview ?? "",
        genre_ids: item.genre_ids ?? [],
      });
    }
  }

  candidates.sort((a, b) => b.vote_average - a.vote_average);
  return candidates.slice(0, 10);
}

function deriveWatchStatus(item: any): WatchStatus {
  if (item.watched) return "completed";
  if (item.in_progress) return "watching";
  if (item.want_to_watch) return "plan_to_watch";
  return "plan_to_watch";
}

export async function getListItems(listId: string): Promise<MediaListItemWithMedia[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .schema("watching")
    .from("media_list_items")
    .select("id, position, note, added_at, media_items(*)")
    .eq("list_id", listId)
    .order("position", { ascending: true });
  if (error) throw error;
  return (data ?? [])
    .filter((d: any) => d.media_items)
    .map((d: any) => ({
      list_item_id: d.id,
      position: d.position,
      note: d.note,
      added_at: d.added_at,
      media: { ...d.media_items, watch_status: deriveWatchStatus(d.media_items) } as WatchingMedia,
    }));
}

export async function searchMediaForList(userId: string, query: string): Promise<WatchingMedia[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .schema("watching")
    .from("media_items")
    .select("*")
    .eq("user_id", userId)
    .ilike("title", `%${query}%`)
    .order("updated_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  return (data as WatchingMedia[]) ?? [];
}

export async function updateMediaList(
  id: string,
  data: { name?: string; emoji?: string | null; description?: string | null; is_ranked?: boolean }
): Promise<MediaList> {
  const supabase = createClient();
  const { data: result, error } = await supabase
    .schema("watching")
    .from("media_lists")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return result as MediaList;
}

export async function updateListItemNote(listItemId: string, note: string | null): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .schema("watching")
    .from("media_list_items")
    .update({ note })
    .eq("id", listItemId);
  if (error) throw error;
}

export interface MediaListWithThumbnails extends MediaList {
  count: number;
  thumbnails: { poster_url: string | null; title: string }[];
}

export async function getListsWithThumbnails(userId: string): Promise<MediaListWithThumbnails[]> {
  const supabase = createClient();
  const { data: lists, error } = await supabase
    .schema("watching")
    .from("media_lists")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  if (!lists?.length) return [];

  const listIds = lists.map((l: any) => l.id);
  const { data: items } = await supabase
    .schema("watching")
    .from("media_list_items")
    .select("list_id, media_items(id, poster_url, title)")
    .in("list_id", listIds)
    .order("position", { ascending: true });

  const byList = new Map<string, { poster_url: string | null; title: string }[]>();
  for (const item of items ?? []) {
    const mi = (item as any).media_items;
    if (!mi) continue;
    if (!byList.has((item as any).list_id)) byList.set((item as any).list_id, []);
    byList.get((item as any).list_id)!.push({ poster_url: mi.poster_url, title: mi.title });
  }

  return (lists as MediaList[]).map((list) => ({
    ...list,
    count: byList.get(list.id)?.length ?? 0,
    thumbnails: (byList.get(list.id) ?? []).slice(0, 4),
  }));
}

// =====================================================
// WATCHING SERVICE (TMDB API)
// =====================================================

const TMDB_BASE = "https://api.themoviedb.org/3";

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

// =====================================================
// EPISODE HIGHLIGHTS (Supabase)
// =====================================================

export async function getEpisodeHighlights(mediaItemId: string): Promise<EpisodeHighlight[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .schema("watching")
    .from("episode_highlights")
    .select("*")
    .eq("media_item_id", mediaItemId)
    .order("season", { ascending: true })
    .order("episode", { ascending: true });
  if (error) throw error;
  return (data ?? []) as EpisodeHighlight[];
}

export async function addEpisodeHighlight(payload: {
  media_item_id: string;
  user_id: string;
  org_id: string;
  season: number;
  episode: number;
  title: string | null;
  still_path: string | null;
  note?: string | null;
}): Promise<EpisodeHighlight> {
  const supabase = createClient();
  const { data, error } = await supabase
    .schema("watching")
    .from("episode_highlights")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data as EpisodeHighlight;
}

export async function removeEpisodeHighlight(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .schema("watching")
    .from("episode_highlights")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// TMDB — single episode details (title + still)
export async function getTmdbEpisode(tmdbId: number, season: number, episode: number) {
  return tmdbFetch<{ name: string; still_path: string | null; episode_number: number; season_number: number }>(
    `tv/${tmdbId}/season/${season}/episode/${episode}`
  );
}

// Movie or tv details with credits
export async function getMediaDetails(id: number, type: "movie" | "tv") {
  return tmdbFetch<any>(`${type}/${id}`, { append_to_response: "credits" });
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