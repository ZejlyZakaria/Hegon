/* eslint-disable @typescript-eslint/no-explicit-any */

import { downscaleImage } from "@/shared/utils/downscale-image";
import { createClient } from "@/infrastructure/supabase/client";
import { getCurrentOrgId } from "@/shared/utils/getOrgId";
import type { WatchingMedia, MediaType, EpisodeHighlight, MediaList, MediaListItem, MediaListItemWithMedia, TmdbListResult, ThemeFavorite, ThemeFavoriteInput, Rewatch } from "./types";
import { deriveWatchStatus } from "./lib/watch-status";
import { insertMediaSchema, updateMediaSchema } from "./schemas/media.schema";

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
  /** THE FACTS the banner needs, so it stops inferring the outcome from the button you pressed. */
  type: MediaType;
  status: string | null;
  favorite: boolean;
  priority: number | null;
  in_progress: boolean;
  want_to_watch: boolean;
  watched: boolean;
  paused: boolean;
  dropped: boolean;
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
    .select("id,type,status,favorite,priority,in_progress,want_to_watch,watched,paused,dropped,user_rating,notes,current_season,current_episode")
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
  // Shrink first, THEN name the file: downscaleImage may hand back a .webp, and a path that
  // still says .jpg would describe bytes that aren't there.
  const upload = await downscaleImage(file);
  const ext = upload.name.split(".").pop() ?? "jpg";
  const filePath = `${user.id}/posters/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("posters").upload(filePath, upload);
  if (error) return null;
  const { data: urlData } = supabase.storage.from("posters").getPublicUrl(filePath);
  return urlData.publicUrl;
}

// Section carousels (In Progress / Recently Watched / Want to Watch / Top 10) only
// need what MediaCarousel + MovieCard + MediaActionMenu render — NOT select("*").
// Deliberately excludes description/notes/season jsonbs/cast_members/directors, etc.
// Clicking a card refetches the full row by id, so nothing downstream is starved.
// `season_years` is here for one reason, and it is NOT display: the "+1" button on an
// In Progress card can roll over a season, and rolling over stamps the finished season's
// year. stampSeasons MERGES into the existing map — so if the map isn't loaded, it merges
// into `undefined`, and writing the result REPLACES the jsonb column with a single entry.
// Every year you'd ever set by hand would be gone. Load it, or don't write it.
// `release_date` + `status` ride along so the film sections can split want_to_watch into
// "Waiting for" (unreleased) vs ready-to-watch, all client-side from one cached fetch.
// `tmdb_id` is here for the LENS, not for display: without it a card cannot look up its AniList
// cours, so a lumped anime printed its flat episode ("S01 E59") on the tile while its own detail
// page said "S03 E12". A surface can only speak the right coordinates if it carries the key to them.
// `last_watched_at` is here for the Undo on a card's "+1" toast: undoing has to put the date back
// where it was, and a surface can only restore a value its own query brought along. (Same lesson as
// `tmdb_id`, which the lens needed and this list didn't carry — a surface can't speak about a fact
// it never selected.)
const SECTION_COLUMNS =
  "id, type, tmdb_id, title, original_title, poster_url, backdrop_url, year, release_date, user_rating, favorite, tags, priority, priority_level, want_to_watch, watched, watched_at, last_watched_at, in_progress, current_season, current_episode, season_episodes, season_aired, season_years, status, caught_up_at";

export async function getMediaItems(
  userId: string,
  type: MediaType,
  options: GetMediaOptions = {}
): Promise<WatchingMedia[]> {
  const supabase = createClient();
  let query = supabase
    .schema("watching")
    .from("media_items")
    .select(SECTION_COLUMNS)
    .eq("user_id", userId)
    .eq("type", type);

  if (options.inProgress) query = query.eq("in_progress", true);
  // RECENTLY WATCHED IS DERIVED, NOT STAMPED. It used to filter on a boolean `recently_watched`
  // set once at add time by an arbitrary 30-day window — and never cleared. So a film watched last
  // month with the flag unset never appeared, while films watched years ago sat there forever: the
  // section showed "what came through this door", not "what I watched recently". It is now simply
  // your watched titles, newest first, capped by the limit — the recency is the ORDER, and old ones
  // fall off the bottom on their own. (The section already promised "your 10 most recently watched";
  // now it delivers it.)
  if (options.recentlyWatched) query = query.eq("watched", true);
  if (options.wantToWatch) query = query.eq("want_to_watch", true);
  if (options.watched) query = query.eq("watched", true);

  if (options.topRated) {
    query = query
      .eq("favorite", true)
      .not("priority", "is", null)
      .order("priority", { ascending: true });
  } else if (options.recentlyWatched) {
    // By actual watch date, not updated_at (which moves on any rating/favorite edit). Undated
    // watched rows (legacy) sort last rather than hijacking the top.
    query = query.order("watched_at", { ascending: false, nullsFirst: false });
  } else {
    query = query.order("updated_at", { ascending: false });
  }

  // Default safety limit: a user with 500+ films would otherwise fetch everything.
  // Library view should opt-in to a higher limit explicitly. Audit §3.5.
  query = query.limit(options.limit ?? 100);

  const { data, error } = await query;
  if (error) throw error;
  return (data as unknown as WatchingMedia[]) ?? [];
}

// All watched media (any type) for the Library, newest first. Backs a live client
// query so the Library reflects cross-surface adds/deletes (independent of the
// Next.js RSC router cache).
// Only the columns the Library actually renders/sorts/searches/badges on — NOT
// select("*"). At a few hundred titles, dropping description/notes/backdrop/season
// arrays cuts the payload several-fold. Keep in sync with the server seed in
// library/page.tsx. (Status flags + current S/E power the Watching/Dropped badges.)
// The airing columns are here for a reason that is not display: the "…" menu on a Library card
// offers to mark a title watched, and it CANNOT do that honestly without knowing whether the show
// is over (`status`) and where its last aired episode is (`season_aired`). Starved of those, the
// menu wrote `watched: true` over a blank position — manufacturing the exact rows a migration had
// just repaired. A surface that may act on a fact must be given the fact.
const LIBRARY_COLUMNS =
  "id, type, title, original_title, poster_url, favorite, year, user_rating, watched_at, updated_at, tags, watched, in_progress, dropped, drop_reason, paused, current_season, current_episode, status, season_episodes, season_aired, season_years, caught_up_at";

export async function getLibraryMedia(userId: string): Promise<WatchingMedia[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .schema("watching")
    .from("media_items")
    .select(LIBRARY_COLUMNS)
    .eq("user_id", userId)
    // Everything you've engaged with — seen, seeing, paused, or abandoned. Reference
    // stubs have all these flags false, so they're excluded automatically.
    .or("watched.eq.true,in_progress.eq.true,dropped.eq.true,paused.eq.true")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data as unknown as WatchingMedia[]) ?? [];
}

// tmdb_ids the user already owns for a given type — used to hide already-owned
// recommendations from "More Like This" (mirrors the For You exclusion).
export async function getOwnedTmdbIds(userId: string, type: MediaType): Promise<number[]> {
  // Guard: an empty user_id builds an invalid PostgREST filter (`user_id=eq.`) → 400.
  if (!userId) return [];
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
  /**
   * Episodes ACTUALLY AIRED per season. Stats used to count hours from `season_episodes` — the
   * ANNOUNCED counts — so it billed you for episodes that do not exist yet, and disagreed with the
   * detail page's Quick Stats about the same title. The rule does not stop at this page's door.
   */
  season_aired: number[] | null;
  episodes: number | null;
  user_rating: number | null;
  favorite: boolean;
  watched_at: string | null;
  tags: string[] | null;  // genre names (stored from TMDB at add time)
  // In-progress support — Hours Watched counts partially-watched series/anime too.
  // Paused/dropped shows keep their watched episodes → they still count real time.
  watched: boolean;
  in_progress: boolean;
  paused: boolean;
  dropped: boolean;
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
    .select("id, type, title, original_title, poster_url, backdrop_url, year, runtime, season_episodes, season_aired, episodes, user_rating, favorite, watched_at, tags, watched, in_progress, paused, dropped, current_season, current_episode, updated_at, season_years, season_ratings, season_posters")
    .eq("user_id", userId)
    // Anything you spent time on — completed, watching, paused, or dropped. The
    // episodes you actually watched are real hours regardless of current status.
    .or("watched.eq.true,in_progress.eq.true,paused.eq.true,dropped.eq.true")
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
  // THE UPDATE BARRIER, IN THE PIPE — the twin of insertMediaItem's guard. Until now the invariant
  // (a position write must recompute caught_up_at) lived only in useUpdateMedia's memory, and one
  // caller — addTmdbItemToList's heal branch — already walked around it. Enforced here, no update
  // path can skip it, including ones not written yet.
  //
  // VALIDATION ONLY — we parse to make superRefine THROW on a broken invariant, and then write the
  // original `data`, never the parse output. So the schema stripping unknown "world fact" columns
  // (runtime, status, studio…) from its return is harmless: those columns still reach the database,
  // because `data` is what we write. The parse is a gate, not a filter.
  updateMediaSchema.parse({ id, ...data });
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
    // `type` and `status` are what let resolveTransition stop GUESSING the outcome from the list you
    // came through. Without them it congratulated you on finishing a show that is still airing.
    .select("id, type, status, favorite, priority, watched, watched_at, in_progress, want_to_watch, paused, dropped, current_episode, current_season, season_episodes, season_aired, season_years, caught_up_at")
    .eq("user_id", userId)
    .eq("type", type)
    .eq("tmdb_id", tmdbId)
    .maybeSingle();
  return data;
}

export async function insertMediaItem(data: Record<string, any>): Promise<WatchingMedia> {
  const supabase = createClient();
  // THE BARRIER, IN THE PIPE — not in the caller's memory. The update path has been gated since the
  // day a comment stating its rule was broken twenty lines below itself; this door had nothing, so
  // a row with no status at all (in your library, in none of its rails) was insertable from any
  // caller, including ones not written yet. It is not, now. Build the status with `addStatusPatch`.
  insertMediaSchema.parse(data);
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
    .is("deleted_at", null)
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
  // The join can't take `.is("deleted_at", null)` on the embedded table, so filter here:
  // a soft-deleted list must not resurface as a chip on a title's detail page.
  return (data ?? [])
    .map((d: any) => d.media_lists)
    .filter((l: any) => l && !l.deleted_at) as MediaList[];
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

  // Clean up an orphaned reference stub: a media_item that only ever existed to sit
  // in a list (is_reference, never tracked) and is now in no other list. Left behind,
  // it lingers and reappears as "already in your library" when you try to re-add it.
  const { data: media } = await supabase
    .schema("watching")
    .from("media_items")
    .select("id, is_reference")
    .eq("id", mediaItemId)
    .maybeSingle();
  if (media && (media as any).is_reference) {
    const { count } = await supabase
      .schema("watching")
      .from("media_list_items")
      .select("id", { count: "exact", head: true })
      .eq("media_item_id", mediaItemId);
    if ((count ?? 0) === 0) {
      await supabase.schema("watching").from("media_items").delete().eq("id", mediaItemId);
    }
  }
}

/**
 * SOFT delete. This used to be `.delete()`, and media_list_items cascades off the list — so a
 * single stray click on a hover icon destroyed a list AND every title in it, irrecoverably.
 * It happened. Meanwhile deleting one title has always asked for confirmation: the most
 * destructive action in the module was the least protected.
 *
 * Now the row stays, its items stay, and it simply stops being read. Undo is one column write.
 */
export async function deleteMediaList(listId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .schema("watching")
    .from("media_lists")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", listId);
  if (error) throw error;
}

/** Undo. The list and its items never left — they were only hidden. */
export async function restoreMediaList(listId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .schema("watching")
    .from("media_lists")
    .update({ deleted_at: null })
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

// `deriveWatchStatus` lived HERE, and a second copy lived in StatusCard.tsx with its priorities in
// a different order (watched before the stances) under a comment claiming the two matched. They
// did not. It now has exactly one home: lib/watch-status.ts.

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

// Typeahead — it runs on every keystroke. `select("*")` dragged back the description, your notes
// and the whole cached `cast_members` jsonb blob to draw a row that shows a poster and a title.
const LIST_SEARCH_COLUMNS = "id, type, title, original_title, poster_url, year, user_rating, tmdb_id";

export async function searchMediaForList(userId: string, query: string): Promise<WatchingMedia[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .schema("watching")
    .from("media_items")
    .select(LIST_SEARCH_COLUMNS)
    .eq("user_id", userId)
    // Reference stubs aren't really "in your library" — exclude them so a title left
    // over from a removed list routes through the enriching TMDB add path instead of
    // masquerading as an owned item.
    .neq("is_reference", true)
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

/**
 * The row you own for a tmdb_id, or null. One lookup on the (user_id, tmdb_id, type) unique
 * index — it exists so a discover page can hand you straight to your REAL fiche, which has your
 * history, your rating and every action a stranger's copy cannot offer.
 */
export async function findOwnedMediaId(userId: string, tmdbId: number): Promise<{ id: string; type: MediaType } | null> {
  // POSSESSION IS DECIDED BY tmdb_id, NOT type. The type is a routing hint (`tmdbResultType` GUESSES
  // it from genre/country) — two authorities for one fact. If it guessed "anime" while your row is a
  // "serie", filtering `.eq("type")` misses your row, discover thinks the title is new, and the
  // unique index (user_id, tmdb_id, type) happily lets a SECOND row of the same show be created.
  // So we match on tmdb_id alone and return the type we found. A bare list stub (is_reference) is not
  // "owned" — redirecting to it would land you on a fiche with no history.
  const supabase = createClient();
  const { data } = await supabase
    .schema("watching")
    .from("media_items")
    .select("id, type")
    .eq("user_id", userId)
    .eq("tmdb_id", tmdbId)
    .not("is_reference", "is", true)
    .limit(1);
  return (data as { id: string; type: MediaType }[] | null)?.[0] ?? null;
}

/**
 * The same question, asked ONCE for a whole list of results.
 *
 * The search used to route every pick to /discover and let that page find out you owned the title
 * and bounce — which cost a full page load and TWO loading states for the most ordinary action in
 * the module. The comment defending it said "no stale ownership cache to keep in sync": true, and
 * it optimised the wrong thing. Knowing which of ten visible results are yours is ONE indexed read
 * on `tmdb_id IN (…)` — cheap enough to run the moment the results appear, so the answer is already
 * there when you click, and the route is right the first time.
 *
 * Batched for the same reason `getAnimeCoursMany` is: one query per list, never one per row.
 * Possession is decided by tmdb_id alone and stubs don't count — see `findOwnedMediaId`, whose
 * rules this shares exactly.
 */
export async function findOwnedMediaIds(
  userId: string,
  tmdbIds: number[],
): Promise<Record<number, { id: string; type: MediaType }>> {
  if (!userId || tmdbIds.length === 0) return {};
  const supabase = createClient();
  const { data, error } = await supabase
    .schema("watching")
    .from("media_items")
    .select("id, type, tmdb_id")
    .eq("user_id", userId)
    .in("tmdb_id", tmdbIds)
    .not("is_reference", "is", true);
  if (error) throw error;
  const out: Record<number, { id: string; type: MediaType }> = {};
  // First row wins, mirroring the `.limit(1)` of the single lookup: a title stored twice under two
  // types is a data problem, and picking a side here at least keeps both surfaces agreeing.
  for (const r of (data as unknown as { id: string; type: MediaType; tmdb_id: number }[]) ?? []) {
    if (!out[r.tmdb_id]) out[r.tmdb_id] = { id: r.id, type: r.type };
  }
  return out;
}

/**
 * The world's facts about a title you do NOT own — a VIRTUAL row.
 *
 * The detail page is really "a tmdb_id + your row": the hero, the genres, the cast, the episodes
 * and the recommendations all derive from the tmdb_id alone. So a title you have never added can
 * render that same page — provided someone builds the row those components expect. This is that.
 *
 * `id` is empty and every personal field is null/false, because none of them are true yet: the
 * discover page mounts only the world half, and the components that need a real row (My Take,
 * Quick Stats, Watch History) simply aren't there. The TMDB mapping is the SAME one
 * `addTmdbItemToList` uses — anime detection, status normalisation, per-season arrays — so what
 * you see before adding is exactly what you get after.
 */
/**
 * The mapping, separated from the fetching — because the bytes it needs are ALREADY in the bundle.
 *
 * `getTmdbDetails` used to own its own `tv/{id}` request, and the bundle is that exact record with
 * more appended to it. So the discover page was asking TMDB for the same resource twice in the same
 * breath: once bare, once with extras. Splitting the pure part out lets the hook select the virtual
 * row straight out of the shared response.
 */
export function mapTmdbDetails(d: any, tmdbId: number, type: MediaType): WatchingMedia | null {
  if (!d || d.success === false) return null;
  const isFilm = type === "film";

  type SeasonLite = { season_number: number; episode_count?: number; poster_path?: string | null; air_date?: string | null };
  // Season 0 is "Specials" — never part of the run, same rule as the add path.
  const seasons: SeasonLite[] = !isFilm && Array.isArray(d.seasons)
    ? (d.seasons as SeasonLite[]).filter((s) => s.season_number > 0)
    : [];

  const rawStatus: string | null = d.status?.toLowerCase() ?? null;
  const date: string | null = isFilm ? (d.release_date ?? null) : (d.first_air_date ?? null);

  return {
    // ── Not yours (yet): no row, no org, no personal state. ──
    id: "", org_id: "", user_id: "",
    watched: false, in_progress: false, want_to_watch: false, dropped: false, paused: false,
    favorite: false, user_rating: null, watched_at: null, priority: null, notes: null,
    created_at: "", updated_at: "",

    // ── The world. ──
    tmdb_id: tmdbId,
    type,
    title: d.title ?? d.name ?? "",
    original_title: d.original_title ?? d.original_name ?? null,
    description: d.overview || null,
    poster_url: d.poster_path ? `https://image.tmdb.org/t/p/w500${d.poster_path}` : null,
    backdrop_url: d.backdrop_path ? `https://image.tmdb.org/t/p/original${d.backdrop_path}` : null,
    year: date ? new Date(date).getFullYear() : 0,
    release_date: isFilm ? (d.release_date ?? null) : null,
    runtime: isFilm ? (d.runtime ?? null) : (d.episode_run_time?.[0] ?? null),
    rating: d.vote_average ?? 0,
    tags: Array.isArray(d.genres) ? d.genres.map((g: { name: string }) => g.name) : [],
    studio: (isFilm ? d.production_companies?.[0]?.name : d.networks?.[0]?.name) ?? undefined,
    // Films keep the raw TMDB status ("released"…); series normalise to ongoing/ended.
    status: (isFilm ? rawStatus : rawStatus === "ended" ? "ended" : "ongoing") as WatchingMedia["status"],
    seasons: isFilm ? undefined : (d.number_of_seasons ?? seasons.length),
    episodes: isFilm ? undefined : (d.number_of_episodes ?? undefined),
    season_episodes: isFilm ? null : seasons.map((s) => s.episode_count ?? 0),
    season_posters: isFilm ? [] : seasons.map((s) => s.poster_path ?? null),
    season_air_dates: isFilm ? [] : seasons.map((s) => s.air_date ?? null),
  };
}

/**
 * The path back out of a TMDB image URL ("…/t/p/w500/abc.jpg" → "/abc.jpg"). We build those URLs
 * ourselves, so recovering the path is safe — and it lets a virtual row hand a real `poster_path`
 * to anything that still speaks TMDB's shape (the add modal, which renders its own sizes).
 */
export function tmdbPathFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const marker = url.indexOf("/t/p/");
  if (marker === -1) return null;
  const afterSize = url.slice(marker + 5).indexOf("/");
  return afterSize === -1 ? null : url.slice(marker + 5 + afterSize);
}

/**
 * movie/tv + genre/country → our three types. "Anime" here = ASIAN animation (Japanese, plus
 * donghua/Korean, which TMDB also tags genre 16); animation from anywhere else stays a regular
 * series. ONE rule, in one place, so search, discover and add can never disagree about what a
 * title IS — a disagreement that would send you to an /anime/ page for something you'd added as
 * a series.
 */
export function tmdbResultType(r: Pick<TmdbListResult, "media_type" | "genre_ids" | "origin_country">): MediaType {
  const ASIAN_ANIMATION = ["JP", "KR", "CN"];
  if (r.media_type === "movie") return "film";
  return r.genre_ids.includes(16) && r.origin_country.some((c) => ASIAN_ANIMATION.includes(c)) ? "anime" : "serie";
}

export async function addTmdbItemToList(
  listId: string,
  userId: string,
  tmdbItem: TmdbListResult
): Promise<MediaListItem> {
  const supabase = createClient();

  const type: MediaType = tmdbResultType(tmdbItem);

  // Match by tmdb_id. A REAL tracked item links as-is; a bare `is_reference` stub
  // (e.g. left over from a previous list add) gets re-enriched in place so it's never
  // reused with missing data.
  const { data: existing } = await supabase
    .schema("watching")
    .from("media_items")
    .select("id, is_reference")
    .eq("user_id", userId)
    .eq("tmdb_id", tmdbItem.id)
    .maybeSingle();

  const existingId = (existing as any)?.id as string | undefined;
  const existingIsReference = (existing as any)?.is_reference === true;

  if (existingId && !existingIsReference) {
    return addMediaToList(listId, existingId, userId);
  }

  // New title OR a reference stub → enrich from the full TMDB detail (like the Add
  // modal): runtime, per-season episodes/posters/air-dates, status, genres. Without
  // this a list-added media stayed a stub (wrong hours/seasons/history once watched).
  // Best-effort: on failure we still create/link from the search-result fields.
  const isFilm = type === "film";
  let details: any = null;
  try {
    const dres = await fetch(`/api/tmdb?endpoint=${isFilm ? "movie" : "tv"}/${tmdbItem.id}&language=en-US`);
    if (dres.ok) details = await dres.json();
  } catch { /* best-effort — fall back to search-result data */ }

  type SeasonLite = { season_number: number; episode_count?: number; poster_path?: string | null; air_date?: string | null };
  const realSeasons: SeasonLite[] = !isFilm && Array.isArray(details?.seasons)
    ? (details.seasons as SeasonLite[]).filter((s) => s.season_number > 0)
    : [];
  const rawStatus = details?.status?.toLowerCase() ?? null;
  // Films keep the raw TMDB status ("released"…); TV/anime normalize to
  // "ongoing"/"ended" (drives useSeasonRefresh). Matches the Add modal exactly.
  const status: string | null = isFilm ? rawStatus : (rawStatus === "ended" ? "ended" : "ongoing");
  const studio: string | null = isFilm
    ? (details?.production_companies?.[0]?.name ?? null)
    : (details?.networks?.[0]?.name ?? null);
  const genres: string[] = Array.isArray(details?.genres) ? details.genres.map((g: { name: string }) => g.name) : [];
  const runtime: number | null = isFilm ? (details?.runtime ?? null) : (details?.episode_run_time?.[0] ?? null);

  // Season/metadata fields shared by insert (new) and heal (existing stub).
  const meta = {
    runtime,
    tags: genres,
    status,
    // FILM release date → powers the "Waiting for" split. Details first (freshest), then the
    // search-result field. Null for series/anime.
    release_date: isFilm ? (details?.release_date ?? tmdbItem.release_date ?? null) : null,
    studio,
    seasons: isFilm ? null : (details?.number_of_seasons ?? realSeasons.length ?? null),
    episodes: isFilm ? null : (details?.number_of_episodes ?? null),
    // [] (not null) for non-series — these columns are NOT NULL DEFAULT '[]'.
    season_episodes: isFilm ? null : realSeasons.map((s) => (s.episode_count ?? 0) as number),
    season_posters: isFilm ? [] : realSeasons.map((s) => (s.poster_path ?? null) as string | null),
    season_air_dates: isFilm ? [] : realSeasons.map((s) => (s.air_date ?? null) as string | null),
  };

  let mediaItemId: string;
  if (existingId) {
    // Heal the leftover reference stub in place, then re-add it to the list.
    await updateMediaItem(existingId, meta);
    mediaItemId = existingId;
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
      favorite: false,
      notes: null,
      ...meta,
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
    .is("deleted_at", null)
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
    thumbnails: (byList.get(list.id) ?? []).slice(0, 5),
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
  // Upsert: an episode may already have a row from a rating — flip highlighted true,
  // preserving its rating (not in the payload → unchanged on conflict).
  const { data, error } = await supabase
    .schema("watching")
    .from("episode_highlights")
    .upsert({ ...payload, highlighted: true }, { onConflict: "user_id,media_item_id,season,episode" })
    .select()
    .single();
  if (error) throw error;
  return data as EpisodeHighlight;
}

// Unmark a best episode. Keep the row if it still carries a rating, else remove it.
export async function removeEpisodeHighlight(id: string): Promise<void> {
  const supabase = createClient();
  const { data, error } = await supabase
    .schema("watching")
    .from("episode_highlights")
    .update({ highlighted: false })
    .eq("id", id)
    .select("id, rating")
    .maybeSingle();
  if (error) throw error;
  if (data && (data as { rating: number | null }).rating == null) {
    await supabase.schema("watching").from("episode_highlights").delete().eq("id", id);
  }
}

// Set a per-episode rating (0-10). Upsert: a fresh row is rating-only (highlighted
// defaults false); on an existing row, keeps its highlighted flag unchanged.
export async function setEpisodeRating(payload: {
  media_item_id: string;
  user_id: string;
  org_id: string;
  season: number;
  episode: number;
  rating: number;
  title: string | null;
  still_path: string | null;
}): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .schema("watching")
    .from("episode_highlights")
    .upsert(payload, { onConflict: "user_id,media_item_id,season,episode" });
  if (error) throw error;
}

// Clear a per-episode rating. Keep the row if it's still a highlight, else remove it.
export async function clearEpisodeRating(mediaItemId: string, season: number, episode: number): Promise<void> {
  const supabase = createClient();
  const { data, error } = await supabase
    .schema("watching")
    .from("episode_highlights")
    .update({ rating: null })
    .match({ media_item_id: mediaItemId, season, episode })
    .select("id, highlighted")
    .maybeSingle();
  if (error) throw error;
  if (data && !(data as { highlighted: boolean }).highlighted) {
    await supabase.schema("watching").from("episode_highlights").delete().eq("id", (data as { id: string }).id);
  }
}

// TMDB — single episode details (title + still)
export async function getTmdbEpisode(tmdbId: number, season: number, episode: number) {
  return tmdbFetch<{ name: string; still_path: string | null; episode_number: number; season_number: number }>(
    `tv/${tmdbId}/season/${season}/episode/${episode}`
  );
}

/**
 * ONE TRIP FOR EVERYTHING A FICHE ASKS TMDB.
 *
 * Opening a title used to fire five separate requests — external_ids, videos, watch/providers,
 * recommendations, content_ratings — all for the SAME resource. They are sub-resources of one
 * record, and TMDB has always been willing to send them together.
 *
 * The count is the smaller half of the win. `external_ids` carries the imdb_id, and OMDb cannot
 * start until it has one — so the ratings were a full round-trip BEHIND a request that had nothing
 * else to wait for. Folding it in here moves OMDb up by that entire trip.
 *
 * ⛔ `credits`/`aggregate_credits` are deliberately NOT appended, and that is measured, not assumed:
 * on House of the Dragon the bundle is 49 KB, and adding them makes it 214 KB (+165 KB) — for data
 * the detail page usually reads from our own `cast_members` column anyway. Trading five trips for a
 * payload four times bigger is not an optimisation. They stay in `getMediaDetails`, fetched only
 * when a title has no stored cast.
 */
export interface TitleBundle {
  external_ids?: { imdb_id?: string | null } | null;
  videos?: { results?: any[] } | null;
  recommendations?: { results?: any[] } | null;
  content_ratings?: { results?: any[] } | null;
  release_dates?: { results?: any[] } | null;
  "watch/providers"?: { results?: Record<string, any> } | null;
  [key: string]: any;
}

/**
 * The regions we actually read for "where to watch" — the two the owner lives in, then the US.
 *
 * IN PRIORITY ORDER. Morocco first is the point: House M.D. and Stranger Things stream on Netflix MA,
 * Inception and Interstellar on Shahid VIP, and showing a French offer for a title he can watch at
 * home would be a worse answer than no answer. Where Morocco has nothing (HBO Max and Apple TV are
 * not distributed there) it falls through to France.
 *
 * GB was here as a "data-rich fallback" so the block was never empty. It earned nothing — measured,
 * every title carrying GB providers already carried FR or US — and that job now belongs to the
 * proxy, which appends one region that actually has something when none of these do.
 *
 * ONE list, declared here and used twice: the proxy trims the payload down to it, and
 * `useWatchProviders` resolves within it. Two copies would eventually disagree, and the symptom
 * would be an empty block for a region the client wanted and the server had already thrown away.
 */
export const PROVIDER_REGIONS = ["MA", "FR", "US"] as const;

export async function getTitleBundle(id: number, type: "movie" | "tv"): Promise<TitleBundle> {
  // Films certify through `release_dates`, shows through `content_ratings` — different endpoints
  // for the same question, which is why `useAgeRating` had to branch on type.
  const ratings = type === "tv" ? "content_ratings" : "release_dates";
  return tmdbFetch<TitleBundle>(`${type}/${id}`, {
    append_to_response: `external_ids,videos,watch/providers,recommendations,${ratings}`,
    providerRegions: PROVIDER_REGIONS.join(","),
  });
}

// ── AnimeThemes (OP/ED) ─────────────────────────────────────────────────────
// Public API, no key. We search by title (no MAL mapping needed) and take the best
// match, then flatten its themes to song + artist + audio/video CDN links.
export interface AnimeThemeTrack {
  id: number;
  label: string;   // "OP1", "ED2"…
  type: string;    // "OP" | "ED"
  title: string;   // song title
  artist: string;  // joined artist names
  audioUrl: string | null;
  videoUrl: string | null;
  cover: string | null;  // resolved iTunes single art (UI falls back to anime poster)
}

// A franchise is split across many AnimeThemes entries (S1, S2, movies, OVAs…),
// each with its own OP/ED. We group by entry name so the whole soundtrack shows.
export interface AnimeThemeGroup {
  name: string;
  year: number | null;
  tracks: AnimeThemeTrack[];
}

function mapThemes(anime: any): AnimeThemeTrack[] {
  return (anime.animethemes ?? [])
    .map((t: any) => {
      const video = t.animethemeentries?.[0]?.videos?.[0];
      return {
        id: t.id,
        label: t.slug,
        type: t.type,
        title: t.song?.title ?? t.slug,
        artist: (t.song?.artists ?? []).map((a: any) => a.name).join(", "),
        audioUrl: video?.audio?.link ?? null,
        videoUrl: video?.link ?? null,
        cover: null,
      } as AnimeThemeTrack;
    })
    .filter((t: AnimeThemeTrack) => t.audioUrl || t.videoUrl);
}

const normName = (s: string) => s.toLowerCase().trim();

// Base franchise name — the anchor's name cut at the first season/part/movie/colon
// marker, so "Shingeki no Kyojin Season 2" and "…: The Final Season" both reduce to
// "shingeki no kyojin" and match every official TV season.
function franchiseBase(name: string): string {
  const n = normName(name);
  const cut = n.search(/(:|\s+season|\s+part|\s+movie|\s+ova|\s+the final|\s+\d)/);
  return (cut > 0 ? n.slice(0, cut) : n).trim();
}

// Only the official TV seasons' OP/ED. Search is fuzzy ("hunter" matches City
// Hunter…), so we anchor on the TV entry whose year matches the title, take its
// base name, and keep only TV entries under that franchise. `year` = media.year.
export async function searchAnimeThemes(title: string, year?: number | null): Promise<AnimeThemeGroup[]> {
  const url =
    `https://api.animethemes.moe/search?q=${encodeURIComponent(title)}` +
    `&fields[search]=anime&include[anime]=animethemes.song.artists,animethemes.animethemeentries.videos.audio`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  const animeList: any[] = data?.search?.anime ?? [];

  const tv = animeList.filter((a) => a.media_format === "TV");
  if (tv.length === 0) return [];

  // Anchor = the TV entry closest to the media's year (the season being viewed).
  const anchor =
    year != null
      ? [...tv].sort((a, b) => Math.abs((a.year ?? 9999) - year) - Math.abs((b.year ?? 9999) - year))[0]
      : tv[0];
  const base = franchiseBase(anchor.name);
  const floor = anchor.year ?? 0; // the adaptation you're viewing — exclude older remakes

  const groups = tv
    .filter((a) => normName(a.name).startsWith(base) && (a.year ?? 9999) >= floor)
    .map((anime) => ({
      name: anime.name as string,
      year: (anime.year as number) ?? null,
      tracks: mapThemes(anime),
    }))
    .filter((g) => g.tracks.length > 0)
    .sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999));

  // Resolve every track's cover up-front (parallel) so the UI never shows a poster
  // placeholder then swaps to the real art. Deduped + cached, so this is near-free
  // after the first lookup of each song.
  await Promise.all(
    groups.flatMap((g) => g.tracks).map(async (t) => {
      t.cover = await searchItunesArtwork(t.title, t.artist);
    }),
  );

  return groups;
}

// Persistent cache for immutable derived URLs (art, banners) — never change, so once
// resolved they're instant on every later visit (and dedupe repeats in a session).
// Hydrated once into an in-memory Map (fast, sync reads); writes to localStorage are
// debounced into a single blob so we never parse/serialize the whole cache per call.
function createUrlCache(storageKey: string) {
  let mem: Map<string, string | null> | null = null;
  let flush: ReturnType<typeof setTimeout> | null = null;
  const store = (): Map<string, string | null> => {
    if (mem) return mem;
    mem = new Map();
    if (typeof window !== "undefined") {
      try {
        const raw = JSON.parse(localStorage.getItem(storageKey) || "{}");
        for (const [k, v] of Object.entries(raw)) mem.set(k, v as string | null);
      } catch { /* corrupt / unavailable — start empty */ }
    }
    return mem;
  };
  const persistSoon = () => {
    if (typeof window === "undefined" || flush) return;
    flush = setTimeout(() => {
      flush = null;
      try { localStorage.setItem(storageKey, JSON.stringify(Object.fromEntries(store()))); } catch { /* quota */ }
    }, 500);
  };
  return { store, persistSoon };
}

const itunesCache = createUrlCache("hegon-itunes-art");

// Per-song artwork via the iTunes Search API (free, no key) — AnimeThemes has no
// song art, so we look each theme up by title+artist and use the single's cover
// (square). Light cleaning of the title (~…ver.~ suffixes) improves matching.
export async function searchItunesArtwork(title: string, artist: string): Promise<string | null> {
  const store = itunesCache.store();
  const key = `${title}|${artist}`;
  if (store.has(key)) return store.get(key) ?? null;

  const cleanTitle = title.replace(/~[^~]*~/g, "").replace(/\(.*?\)/g, "").trim();
  const term = `${cleanTitle} ${artist}`.trim();
  if (!term) return null;
  let art: string | null = null;
  try {
    const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=song&limit=1`);
    if (res.ok) {
      const data = await res.json();
      const raw: string | undefined = data?.results?.[0]?.artworkUrl100;
      art = raw ? raw.replace("100x100bb", "400x400bb") : null; // upscale
    }
  } catch { /* network — leave null, don't poison cache with a transient failure */
    return null;
  }
  store.set(key, art);
  itunesCache.persistSoon();
  return art;
}

// ── Theme favorites ("My Themes") ────────────────────────────────────────────
// Stable natural key for a theme — independent of the in-app track id (which
// embeds a season index). One favorite per (anime, label, song) per org.
export function themeTrackKey(t: { animeName: string; label: string; title: string }): string {
  return `${t.animeName}|${t.label}|${t.title}`.toLowerCase().trim();
}

export async function getThemeFavorites(): Promise<ThemeFavorite[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .schema("watching").from("theme_favorites")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ThemeFavorite[];
}

export async function addThemeFavorite(track: ThemeFavoriteInput): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const orgId = await getCurrentOrgId();
  const { error } = await supabase
    .schema("watching").from("theme_favorites")
    .upsert({
      org_id: orgId,
      user_id: user.id,
      track_key: themeTrackKey(track),
      anime_name: track.animeName,
      label: track.label,
      title: track.title,
      artist: track.artist,
      audio_url: track.audioUrl,
      video_url: track.videoUrl,
      cover: track.cover,
      anime_poster: track.animePoster,
    }, { onConflict: "org_id,track_key" });
  if (error) throw error;
}

export async function removeThemeFavorite(trackKey: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .schema("watching").from("theme_favorites")
    .delete()
    .eq("track_key", trackKey);
  if (error) throw error;
}

// ── Rewatches ────────────────────────────────────────────────────────────────
// One row per re-viewing event of a media item (the first watch stays on
// media_items.watched_at). watchedOn = 'YYYY-MM-DD'.
export async function getRewatches(mediaItemId: string): Promise<Rewatch[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .schema("watching").from("rewatches")
    .select("id, media_item_id, watched_on, created_at")
    .eq("media_item_id", mediaItemId)
    .order("watched_on", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Rewatch[];
}

export async function addRewatch(mediaItemId: string, watchedOn: string): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const orgId = await getCurrentOrgId();
  const { error } = await supabase
    .schema("watching").from("rewatches")
    .insert({ org_id: orgId, user_id: user.id, media_item_id: mediaItemId, watched_on: watchedOn });
  if (error) throw error;
}

export async function removeRewatch(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .schema("watching").from("rewatches")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// All rewatch events for the user (Stats). Joined to items in computeStats by
// media_item_id — each event adds the title's full runtime to Hours Watched.
export interface RewatchStatItem { media_item_id: string; watched_on: string; }
export async function getRewatchStats(userId: string): Promise<RewatchStatItem[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .schema("watching").from("rewatches")
    .select("media_item_id, watched_on")
    .eq("user_id", userId);
  if (error) throw error;
  return (data ?? []) as RewatchStatItem[];
}

// Full season with episodes (stills, titles, overviews, tmdb ratings).
export async function getSeasonEpisodes(id: number, season: number) {
  return tmdbFetch<any>(`tv/${id}/season/${season}`);
}

// OMDb data (IMDb/RT/Metacritic ratings, awards, box office) by imdb id — via the
// /api/omdb proxy so the key stays server-side. Pass `season` for the heatmap.
export async function getOmdbData(imdbId: string, season?: number) {
  const params = new URLSearchParams({ i: imdbId });
  if (season != null) params.set("Season", String(season));
  const res = await fetch(`/api/omdb?${params.toString()}`);
  if (!res.ok) throw new Error(`OMDb fetch failed: ${res.status}`);
  return res.json();
}


// Movie or tv details with credits. TV/anime cast is sparse/empty in `credits`
// (the recurring voice cast lives in `aggregate_credits`), so append both for tv.
export async function getMediaDetails(id: number, type: "movie" | "tv") {
  const append = type === "tv" ? "credits,aggregate_credits" : "credits";
  return tmdbFetch<any>(`${type}/${id}`, { append_to_response: append });
}

// =====================================================
// PERSON — TMDB people + your titles with them
// =====================================================

export interface PersonProfile {
  id: number;
  name: string;
  profile_url: string | null;
  biography: string | null;
  birthday: string | null;
  place_of_birth: string | null;
  known_for_department: string | null;
}

export interface PersonCredit {
  tmdb_id: number;
  type: MediaType;          // tv→serie (anime is a user choice on add)
  title: string;
  poster_url: string | null;
  backdrop_url: string | null;
  year: number | null;
  vote: number;
  popularity: number;
  role: string | null;      // character (acting) or job (directing)
  department: "Acting" | "Directing";
}

const NOISE_GENRES = new Set([10767, 10763, 10764]); // Talk · News · Reality
const SELF_ROLE = /^(self|himself|herself|themselves)\b/i;
// TMDB's own marker for a walk-on: "Narrator (voice) (uncredited)". It's the ONLY signal
// that separates noise from a real role — `order` doesn't (Spacey is order 56 on Se7en as
// John Doe, exactly like Jackson's uncredited narration on Inglourious Basterds).
const UNCREDITED_ROLE = /\(uncredited\)/i;

// Profile + full filmography in ONE TMDB call (append_to_response). The filmography is
// de-noised (no talk-show "Self", no News/Reality, must have a poster) and de-duped, so
// "his whole filmo" = his real acting/directing work, not a wall of TV appearances.
export async function getPersonBundle(
  id: number,
): Promise<{ profile: PersonProfile; credits: PersonCredit[] }> {
  const p = await tmdbFetch<any>(`person/${id}`, { append_to_response: "combined_credits" });

  const profile: PersonProfile = {
    id: p.id,
    name: p.name,
    profile_url: p.profile_path ? `https://image.tmdb.org/t/p/w300${p.profile_path}` : null,
    biography: p.biography || null,
    birthday: p.birthday || null,
    place_of_birth: p.place_of_birth || null,
    known_for_department: p.known_for_department || null,
  };

  const toCredit = (c: any, role: string | null, dept: "Acting" | "Directing"): PersonCredit | null => {
    const mt = c.media_type;
    if (mt !== "movie" && mt !== "tv") return null;
    const title = c.title || c.name;
    if (!title || !c.poster_path) return null;
    if (dept === "Acting" && role && (SELF_ROLE.test(role) || UNCREDITED_ROLE.test(role))) return null;
    if (mt === "tv" && (c.genre_ids ?? []).some((g: number) => NOISE_GENRES.has(g))) return null;
    const date = c.release_date || c.first_air_date || "";
    return {
      tmdb_id: c.id,
      type: mt === "movie" ? "film" : "serie",
      title,
      poster_url: `https://image.tmdb.org/t/p/w342${c.poster_path}`,
      backdrop_url: c.backdrop_path ? `https://image.tmdb.org/t/p/w1280${c.backdrop_path}` : null,
      year: date ? Number(date.slice(0, 4)) || null : null,
      vote: c.vote_average ?? 0,
      popularity: c.popularity ?? 0,
      role,
      department: dept,
    };
  };

  const cc = p.combined_credits ?? {};
  const acting: (PersonCredit | null)[] = (cc.cast ?? []).map((c: any) => toCredit(c, c.character || null, "Acting"));
  const directing: (PersonCredit | null)[] = (cc.crew ?? [])
    .filter((c: any) => ["Director", "Creator", "Series Director"].includes(c.job))
    .map((c: any) => toCredit(c, c.job || "Director", "Directing"));

  // Same title can appear twice (or as both cast & crew) → keep the most-voted, then
  // most popular first.
  const byId = new Map<number, PersonCredit>();
  for (const c of [...acting, ...directing].filter(Boolean) as PersonCredit[]) {
    const prev = byId.get(c.tmdb_id);
    if (!prev || c.vote > prev.vote) byId.set(c.tmdb_id, c);
  }
  const credits = [...byId.values()].sort((a, b) => b.popularity - a.popularity);

  return { profile, credits };
}

// A person as stored on a media item (cast_members / directors entries).
export interface PersonRef {
  id?: number;
  name: string;
  character?: string | null;
  profile_url?: string | null;
}

export interface PersonTitle {
  id: string;
  type: MediaType;
  title: string;
  poster_url: string | null;
  backdrop_url: string | null;
  year: number | null;
  runtime: number | null;
  user_rating: number | null;
  watched: boolean;
  in_progress: boolean;
  want_to_watch: boolean;
  paused: boolean;
  dropped: boolean;
  priority: number | null;   // Top 10 rank (per type) — null = not in a Top 10
  current_season: number | null;
  current_episode: number | null;
  watched_at: string | null;
  tmdb_id: number;
  role: string | null;
  // The other people on this title — feeds "Seen together".
  cast_members: PersonRef[];
  directors: PersonRef[];
}

const PERSON_TITLE_COLUMNS =
  "id, type, title, poster_url, backdrop_url, year, runtime, user_rating, watched, in_progress, want_to_watch, paused, dropped, priority, current_season, current_episode, watched_at, tmdb_id, cast_members, directors";

// Your collection titles featuring this person — matched on the person's TMDB filmography
// (their credits' tmdb_ids) ∩ your library, NOT on stored cast_members (which caps at ~12
// and misses uncredited/low-billed roles, e.g. Kevin Spacey in Se7en). `favorite` covers
// Top 10 items. Roles are attached client-side from the credits. Type is matched by the
// caller (film vs tv/anime) since the ids alone can collide across TMDB namespaces.
export async function getTitlesByPerson(userId: string, creditTmdbIds: number[]): Promise<PersonTitle[]> {
  if (!userId || creditTmdbIds.length === 0) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .schema("watching").from("media_items").select(PERSON_TITLE_COLUMNS)
    .eq("user_id", userId)
    .in("tmdb_id", creditTmdbIds)
    .or("watched.eq.true,in_progress.eq.true,dropped.eq.true,paused.eq.true,want_to_watch.eq.true,favorite.eq.true");
  if (error) throw error;
  return (data ?? []).map((r: any): PersonTitle => ({
    id: r.id, type: r.type, title: r.title, poster_url: r.poster_url, backdrop_url: r.backdrop_url,
    year: r.year, runtime: r.runtime, user_rating: r.user_rating, watched: r.watched,
    in_progress: r.in_progress, want_to_watch: r.want_to_watch, paused: r.paused, dropped: r.dropped,
    priority: r.priority ?? null, current_season: r.current_season, current_episode: r.current_episode,
    watched_at: r.watched_at, tmdb_id: r.tmdb_id, role: null,
    cast_members: r.cast_members ?? [], directors: r.directors ?? [],
  }));
}

// Every rating you've given inside one type — the basis of "you rated this higher than
// 84% of your films". Compared WITHIN a type on purpose: ranking a series against your
// films would make the sentence false.
export async function getRatingsForType(userId: string, type: MediaType): Promise<number[]> {
  if (!userId) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .schema("watching").from("media_items").select("user_rating")
    .eq("user_id", userId)
    .eq("type", type)
    .not("user_rating", "is", null);
  if (error) throw error;
  return (data ?? []).map((r: { user_rating: number }) => r.user_rating);
}

export interface PersonCount { n: number; name: string }

// How many titles you've SEEN each person in, across your whole library — the basis of
// "your #3 most-watched actor" (names included, so a tie can be named). Two lean jsonb
// columns for the rows you actually watched (want_to_watch excluded: it isn't a shared
// history yet). Client-side aggregation is enough at this size and keeps it one cached read.
export async function getPeopleCounts(
  userId: string,
): Promise<{ acting: Record<number, PersonCount>; directing: Record<number, PersonCount> }> {
  const acting: Record<number, PersonCount> = {};
  const directing: Record<number, PersonCount> = {};
  if (!userId) return { acting, directing };

  const supabase = createClient();
  const { data, error } = await supabase
    .schema("watching").from("media_items").select("cast_members, directors")
    .eq("user_id", userId)
    .or("watched.eq.true,in_progress.eq.true,dropped.eq.true,paused.eq.true,favorite.eq.true");
  if (error) throw error;

  for (const row of (data ?? []) as any[]) {
    // A person can be listed twice on one title — count the title once per role
    // (an actor-director like Eastwood still counts in both buckets).
    const bump = (bucket: Record<number, PersonCount>, people: PersonRef[] | null) => {
      const seen = new Set<number>();
      for (const p of people ?? []) {
        if (!p?.id || seen.has(p.id)) continue;
        seen.add(p.id);
        const prev = bucket[p.id];
        if (prev) prev.n += 1;
        else bucket[p.id] = { n: 1, name: p.name };
      }
    };
    bump(acting, row.cast_members);
    bump(directing, row.directors);
  }
  return { acting, directing };
}

// ── Anime v2 — AniList season overlay (read-only) ──
// The real per-season breakdown of an anime TMDB lumps into one flat season, resolved by the
// `resolve-anime-cours` job into the SHARED watching.anime_cours table (keyed by tmdb_id, same for
// every user). The app only trusts source 'anilist'; 'mismatch'/'none'/missing → the caller falls
// back to TMDB's flat structure. One instant DB read, no AniList call at request time.
export async function getAnimeCours(tmdbId: number): Promise<import("./types").AnimeCoursRow | null> {
  if (!tmdbId) return null;
  const supabase = createClient();
  const { data, error } = await supabase
    .schema("watching").from("anime_cours")
    .select("tmdb_id, cours, source")
    .eq("tmdb_id", tmdbId)
    .maybeSingle();
  if (error) throw error;
  return (data as import("./types").AnimeCoursRow | null) ?? null;
}

/**
 * The cours for a whole RAIL, in ONE read.
 *
 * A carousel renders twenty cards; asking per card would be twenty round trips for a table of a few
 * dozen rows. The lens is supposed to make the overlay free at every surface — it must not make the
 * cheapest surfaces the most expensive.
 */
export async function getAnimeCoursMany(
  tmdbIds: number[],
): Promise<Map<number, import("./types").AnimeCoursRow>> {
  const ids = [...new Set(tmdbIds.filter(Boolean))];
  if (ids.length === 0) return new Map();
  const supabase = createClient();
  const { data, error } = await supabase
    .schema("watching").from("anime_cours")
    .select("tmdb_id, cours, source")
    .in("tmdb_id", ids);
  if (error) throw error;
  const rows = (data ?? []) as import("./types").AnimeCoursRow[];
  return new Map(rows.map((r) => [r.tmdb_id, r]));
}

// Hero data (trending + recommendations) — read from the GLOBAL trending cache
// (watching.trending_cache, refreshed daily by the `trending-refresh` cron). One
// shared row per type → instant DB read, zero TMDB latency at request time. The
// heavy TMDB fetching now lives in the edge function. Items are the raw TMDB list
// objects, so "Add to collection" (which re-fetches full details by id) is
// unaffected. Global reference content — not per-user, so it never duplicates.
export async function getWatchingHeroData(
  type: MediaType,
): Promise<{ trending: any; recommendations: any[] }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .schema("watching").from("trending_cache")
    .select("items")
    .eq("type", type)
    .maybeSingle();
  if (error) throw error;
  const items = (data?.items ?? {}) as { trending?: any; recommendations?: any[] };
  return { trending: items.trending ?? null, recommendations: items.recommendations ?? [] };
}