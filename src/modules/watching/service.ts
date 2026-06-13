/* eslint-disable @typescript-eslint/no-explicit-any */

import { createClient } from "@/infrastructure/supabase/client";
import { getCurrentOrgId } from "@/shared/utils/getOrgId";
import type { WatchingMedia, MediaType, WatchStatus, EpisodeHighlight, MediaList, MediaListItem, MediaListItemWithMedia, TmdbListResult } from "./types";

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

// ── AddMediaModal helpers (extracted from the component — service-layer rule) ──

export interface ExistingMediaEntry {
  id: string;
  favorite: boolean;
  priority: number | null;
  in_progress: boolean;
  want_to_watch: boolean;
  watched: boolean;
  recently_watched: boolean;
  user_rating: number | null;
  notes: string | null;
  current_season: number | null;
  current_episode: number | null;
}

export async function getTakenPriorities(type: MediaType): Promise<number[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .schema("watching").from("media_items")
    .select("priority")
    .eq("user_id", user.id)
    .eq("type", type)
    .eq("favorite", true)
    .not("priority", "is", null);
  return (data ?? []).map((i: { priority: number }) => i.priority);
}

export async function getExistingMediaEntry(
  type: MediaType,
  tmdbId: number,
): Promise<ExistingMediaEntry | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .schema("watching").from("media_items")
    .select("id,favorite,priority,in_progress,want_to_watch,watched,recently_watched,user_rating,notes,current_season,current_episode")
    .eq("user_id", user.id)
    .eq("type", type)
    .eq("tmdb_id", tmdbId)
    .maybeSingle();
  return (data as ExistingMediaEntry | null) ?? null;
}

export async function uploadCustomPoster(file: File): Promise<string | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const ext = file.name.split(".").pop();
  const filePath = `${user.id}/posters/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("posters").upload(filePath, file);
  if (error) return null;
  const { data: urlData } = supabase.storage.from("posters").getPublicUrl(filePath);
  return urlData.publicUrl;
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
  } else if (options.recentlyWatched) {
    // "Recently Watched" = by actual watch date, not updated_at (which moves on
    // any rating/favorite edit). watched_at is set when the item is marked watched.
    query = query.order("watched_at", { ascending: false });
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

// All watched media (any type) for the Library, newest first. Backs a live client
// query so the Library reflects cross-surface adds/deletes (independent of the
// Next.js RSC router cache).
// Only the columns the Library actually renders/sorts/searches on — NOT select("*").
// At a few hundred watched titles, dropping description/notes/backdrop/season arrays
// cuts the payload several-fold. Keep in sync with the server seed in library/page.tsx.
const LIBRARY_COLUMNS =
  "id, type, title, original_title, poster_url, favorite, year, user_rating, watched_at, tags";

export async function getAllWatchedMedia(userId: string): Promise<WatchingMedia[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .schema("watching")
    .from("media_items")
    .select(LIBRARY_COLUMNS)
    .eq("user_id", userId)
    .eq("watched", true)
    .order("watched_at", { ascending: false });
  if (error) throw error;
  return (data as unknown as WatchingMedia[]) ?? [];
}

// tmdb_ids the user already owns for a given type — used to hide already-owned
// recommendations from "More Like This" (mirrors the For You exclusion).
export async function getOwnedTmdbIds(userId: string, type: MediaType): Promise<number[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .schema("watching")
    .from("media_items")
    .select("tmdb_id")
    .eq("user_id", userId)
    .eq("type", type);
  if (error) throw error;
  return (data ?? []).map((i: { tmdb_id: number }) => i.tmdb_id);
}

export interface StatsRawItem {
  id: string;
  type: string;
  title: string;
  original_title: string | null;
  poster_url: string | null;
  backdrop_url: string | null;
  year: number;
  runtime: number | null;        // films = total mins ; series/anime = per-episode mins
  season_episodes: number[] | null;
  episodes: number | null;
  user_rating: number | null;
  favorite: boolean;
  watched_at: string | null;
  tags: string[] | null;  // genre names (stored from TMDB at add time)
  // In-progress support — Hours Watched counts partially-watched series/anime too.
  watched: boolean;
  in_progress: boolean;
  current_season: number | null;
  current_episode: number | null;
  updated_at: string | null;     // attribution date for in-progress hours
  season_years: Record<string, number> | null;    // per-season watch year
  season_ratings: Record<string, number> | null;  // per-season rating
  season_posters: (string | null)[] | null;       // per-season TMDB poster_path
}

export async function getWatchingStatsData(userId: string): Promise<StatsRawItem[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .schema("watching")
    .from("media_items")
    .select("id, type, title, original_title, poster_url, backdrop_url, year, runtime, season_episodes, episodes, user_rating, favorite, watched_at, tags, watched, in_progress, current_season, current_episode, updated_at, season_years, season_ratings, season_posters")
    .eq("user_id", userId)
    .or("watched.eq.true,in_progress.eq.true")
    .neq("is_reference", true);
  if (error) throw error;
  return (data ?? []) as StatsRawItem[];
}

// Recent watched activity (type + date) for the Watching→Habits bridge. Only
// what's needed to auto-tick linked habits; window-limited by the caller.
export async function getRecentWatchedActivity(
  since: string, // 'YYYY-MM-DD'
): Promise<{ type: string; watched_at: string }[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .schema("watching")
    .from("media_items")
    .select("type, watched_at")
    .eq("user_id", user.id)
    .eq("watched", true)
    .neq("is_reference", true)
    .gte("watched_at", since);
  if (error) throw error;

  return (data ?? [])
    .filter((r: { type: string | null; watched_at: string | null }) => !!r.type && !!r.watched_at)
    .map((r: { type: string; watched_at: string }) => ({ type: r.type, watched_at: r.watched_at }));
}

export async function updateMediaItem(
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

export async function deleteMediaItem(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .schema("watching")
    .from("media_items")
    .delete()
    .eq("id", id);
  if (error) throw error;
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
    .select("id, favorite, priority, watched, recently_watched, watched_at, in_progress, want_to_watch, current_episode, current_season")
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
// FOR YOU — precomputed recommendations (read-only)
// =====================================================
// The heavy work (favorites → TMDB "more like this" → score → rank) runs in the
// `for-you-refresh` edge function on a 5-day cron and is stored in
// watching.for_you_cache. Here we just READ that table → instant. Owned/dismissed
// filtering and the 10-of-20 reserve slice happen client-side, so adding a title
// updates the carousel live without recomputing or refetching from TMDB.

export interface ForYouItem {
  id: number;
  title: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  year: string;
  overview: string;
  genre_ids: number[];
  is_new?: boolean;   // newly surfaced in the latest 5-day rotation
}

export async function getForYouRecommendations(
  userId: string,
  type: MediaType
): Promise<ForYouItem[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .schema("watching").from("for_you_cache")
    .select("items")
    .eq("user_id", userId)
    .eq("type", type)
    .maybeSingle();
  if (error) throw error;
  // Returns the full stored reserve (~20); the client filters owned/dismissed
  // and slices to 10. Empty/no row (e.g. not enough watched yet) → no section.
  return (data?.items ?? []) as ForYouItem[];
}

function deriveWatchStatus(item: any): WatchStatus {
  if (item.is_reference) return "reference";
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
    .or(`title.ilike.%${query}%,original_title.ilike.%${query}%`)
    .order("updated_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  return (data as WatchingMedia[]) ?? [];
}

export async function searchTmdbForList(query: string): Promise<TmdbListResult[]> {
  const res = await fetch(
    `/api/tmdb?endpoint=search/multi&query=${encodeURIComponent(query)}&language=en-US&page=1`
  );
  if (!res.ok) return [];
  const data: { results?: any[] } = await res.json();
  return (data.results ?? [])
    .filter((r: any) => r.media_type === "movie" || r.media_type === "tv")
    .map((r: any): TmdbListResult => ({
      id: r.id,
      media_type: r.media_type,
      title: r.title ?? r.name ?? "",
      original_title: r.original_title ?? r.original_name ?? null,
      poster_path: r.poster_path ?? null,
      backdrop_path: r.backdrop_path ?? null,
      release_date: r.release_date ?? null,
      first_air_date: r.first_air_date ?? null,
      vote_average: r.vote_average ?? 0,
      overview: r.overview ?? "",
      genre_ids: r.genre_ids ?? [],
      origin_country: r.origin_country ?? [],
    }))
    .slice(0, 8);
}

export async function addTmdbItemToList(
  listId: string,
  userId: string,
  tmdbItem: TmdbListResult
): Promise<MediaListItem> {
  const supabase = createClient();

  // "Anime" here = Asian animation (Japanese, plus donghua/Korean which TMDB also
  // tags genre 16). Animation from elsewhere stays a regular series.
  const ASIAN_ANIMATION = ["JP", "KR", "CN"];
  const type: MediaType =
    tmdbItem.media_type === "movie" ? "film"
    : tmdbItem.genre_ids.includes(16) && tmdbItem.origin_country.some((c) => ASIAN_ANIMATION.includes(c)) ? "anime"
    : "serie";

  // Check if already in DB (any type, match by tmdb_id)
  const { data: existing } = await supabase
    .schema("watching")
    .from("media_items")
    .select("id")
    .eq("user_id", userId)
    .eq("tmdb_id", tmdbItem.id)
    .maybeSingle();

  let mediaItemId: string;
  if (existing && (existing as any).id) {
    mediaItemId = (existing as any).id;
  } else {
    const year = parseInt((tmdbItem.release_date ?? tmdbItem.first_air_date ?? "").slice(0, 4)) || null;
    const newItem = await insertMediaItem({
      user_id: userId,
      type,
      title: tmdbItem.title,
      original_title: tmdbItem.original_title ?? tmdbItem.title,
      description: tmdbItem.overview,
      poster_url: tmdbItem.poster_path ? `https://image.tmdb.org/t/p/w500${tmdbItem.poster_path}` : null,
      backdrop_url: tmdbItem.backdrop_path ? `https://image.tmdb.org/t/p/original${tmdbItem.backdrop_path}` : null,
      year,
      rating: tmdbItem.vote_average,
      tmdb_id: tmdbItem.id,
      is_reference: true,
      watched: false,
      in_progress: false,
      want_to_watch: false,
      recently_watched: false,
      favorite: false,
      tags: [],
      notes: null,
    });
    mediaItemId = newItem.id;
  }

  return addMediaToList(listId, mediaItemId, userId);
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
    const search = new URLSearchParams({ api_key: key, language: "en-US", ...params });
    const res = await fetch(`${TMDB_BASE}/${endpoint}?${search.toString()}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) throw new Error(`TMDB error: ${res.status}`);
    return res.json();
  }

  // client-side → proxy route
  const search = new URLSearchParams({ endpoint, language: "en-US", ...params });
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

// Movie or tv details with credits. TV/anime cast is sparse/empty in `credits`
// (the recurring voice cast lives in `aggregate_credits`), so append both for tv.
export async function getMediaDetails(id: number, type: "movie" | "tv") {
  const append = type === "tv" ? "credits,aggregate_credits" : "credits";
  return tmdbFetch<any>(`${type}/${id}`, { append_to_response: append });
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