/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { WATCHING_KEYS, TMDB_KEYS } from "./query-keys";
import {
  getExistingMediaItem,
  insertMediaItem,
  updateMediaItem,
} from "../service";
import { createClient } from "@/infrastructure/supabase/client";
import { syncWatchingGoals } from "../lib/sync-goals";
import { syncWatchingHabits } from "../lib/sync-habits";
import { toast } from "@/shared/utils/toast";
import { resolveTransition } from "../lib/resolve-transition";
import { RESET_STATUS } from "../lib/status-flags";
import { airedFromTmdb, seriesState } from "../lib/series-state";
import { DemoReadOnlyError, handledDemoError } from "@/shared/utils/demo-guard";
import { useIsDemo } from "@/modules/settings/hooks/useSettings";
import type { ListType, MediaType } from "../types";

interface AddMediaInput {
  selectedItem: any; // TMDB result
  defaultType: MediaType;
  listContext: ListType;
  userRating: number;
  notes: string;
  favorite: boolean;
  priority: number | null;
  priorityLevel: "high" | "medium" | "low";
  currentSeason: number;
  currentEpisode: number;
  seasons: number | null;
  episodes: number | null;
  runtime: number | null;
  directors: { id?: number; name: string; profile_url: string | null }[] | null;
  cast: { id: number; name: string; character: string | null; profile_url: string | null }[];
  studio: string | null;
  status: string | null;
  customPosterUrl?: string | null;
  genres: string[];
  watchedAt?: string | null;
  /**
   * HOW FAR YOU GOT — for a series, the ONLY honest input. `null` = "not started".
   * The list you came from no longer decides your status; this does. See below.
   */
  position?: { season: number; episode: number } | null;
  /** What happened after you stopped partway: still watching, paused, or done with it. */
  stance?: "watching" | "paused" | "dropped";
}

export function useAddMedia() {
  const queryClient = useQueryClient();
  const isDemo = useIsDemo();

  return useMutation({
    mutationFn: async (input: AddMediaInput) => {
      if (isDemo) throw new DemoReadOnlyError();
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) throw new Error("Not authenticated");

      const {
        selectedItem,
        defaultType,
        listContext,
        userRating,
        notes,
        favorite,
        priority,
        priorityLevel,
        currentSeason,
        currentEpisode,
        seasons,
        episodes,
        runtime,
        directors,
        cast,
        studio,
        status,
        customPosterUrl,
        genres,
        watchedAt,
        position,
        stance,
      } = input;

      const isSeries = defaultType === "serie" || defaultType === "anime";

      // ── THE GUARD ────────────────────────────────────────────────────────────────────────
      // `watched` used to be decided by the DOOR you came through:
      //     watched: listContext === "recentlyWatched" || "topTen" || "library"
      // Three doors that simply ASSERTED you'd finished the thing. For a film that's fine — "seen
      // it / haven't" is binary. For a SERIES it's a lie, and it is the line that manufactured 23
      // rows claiming you'd watched shows that are still running. Adding an ongoing series to your
      // Top 10 marked it finished, silently.
      //
      // Now the status is DERIVED from how far you got, by the same seriesState() the whole app
      // uses. The word "watched" doesn't get refused for an ongoing series — it simply cannot be
      // produced. No future door can re-open this, because there's nothing left to re-open.
      const seasonAiredList = isSeries
        ? airedFromTmdb(
            (selectedItem.seasons ?? []) as { season_number: number; episode_count: number }[],
            selectedItem.last_episode_to_air as { season_number: number; episode_number: number } | undefined,
          )
        : null;

      const seriesFacts = {
        season_aired: seasonAiredList,
        season_episodes: seasonAiredList,
        status,
        current_season: position?.season ?? null,
        current_episode: position?.episode ?? null,
      };
      const state = isSeries && position ? seriesState(seriesFacts) : null;

      // A film keeps the old contract: the door knows. A series obeys its position.
      const filmWatched =
        listContext === "recentlyWatched" || listContext === "topTen" || listContext === "library";
      const isWatched = isSeries ? state === "completed" : filmWatched;

      // And the SECOND word that lied. `in_progress` means "I'm watching this NOW" — but a show
      // you left behind three seasons in, five years ago, is not in progress. It's paused, or
      // it's dropped. Exactly the disease `watched` had (it conflated caught-up with finished),
      // and the app already owned the right words. It just never asked.
      const stoppedPartway = isSeries && !!position && !isWatched && state !== "caught-up";
      const isDropped = stoppedPartway && stance === "dropped";
      const isPaused = stoppedPartway && stance === "paused";
      const isInProgress = isSeries
        ? !!position && !isWatched && !isDropped && !isPaused
        : listContext === "inProgress";
      const caughtUpAt = state === "caught-up" ? new Date().toISOString() : null;

      // THE YEAR YOU GIVE BELONGS TO THE SEASONS YOU CLAIM. Declaring "I watched three seasons"
      // is a statement about the PAST, so it must be datable — and the date has one honest home:
      // the season years. Only FULLY watched seasons are stamped; the one you're in the middle of
      // hasn't happened yet.
      const claimedYear = watchedAt ? new Date(watchedAt).getFullYear() : null;
      const seasonYears: Record<string, number> | null =
        isSeries && position && claimedYear && seasonAiredList
          ? Object.fromEntries(
              seasonAiredList
                .map((aired, i) => ({ season: i + 1, aired }))
                .filter((s) =>
                  s.aired > 0 &&
                  (s.season < position.season ||
                    (s.season === position.season && position.episode >= s.aired)),
                )
                .map((s) => [String(s.season), claimedYear]),
            )
          : null;

      const effectiveWatchedAt = watchedAt ?? new Date().toISOString();
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const isRecentLibraryAdd = listContext === "library" && new Date(effectiveWatchedAt) >= thirtyDaysAgo;

      const posterUrl =
        customPosterUrl ||
        (selectedItem.poster_path
          ? `https://image.tmdb.org/t/p/w500${selectedItem.poster_path}`
          : null);

      const insertData = {
        user_id: userId,
        type: defaultType,
        // Re-adding a paused/dropped title merges onto its existing row — always
        // clear those flags so it never ends up watched/in-progress AND paused/dropped.
        ...RESET_STATUS,
        title: selectedItem.title || selectedItem.name,
        original_title: selectedItem.original_title || selectedItem.original_name,
        description: selectedItem.overview,
        poster_url: posterUrl,
        backdrop_url: selectedItem.backdrop_path
          ? `https://image.tmdb.org/t/p/original${selectedItem.backdrop_path}`
          : null,
        year:
          new Date(
            selectedItem.release_date || selectedItem.first_air_date,
          ).getFullYear() || null,
        runtime,
        rating: selectedItem.vote_average,
        user_rating:
          listContext === "wantToWatch" || listContext === "inProgress"
            ? null
            : userRating > 0
              ? userRating
              : null,
        watched: isWatched,
        dropped: isDropped,
        paused: isPaused,
        caught_up_at: caughtUpAt,
        season_aired: seasonAiredList,
        ...(seasonYears ? { season_years: seasonYears } : {}),
        recently_watched: isWatched && (listContext === "recentlyWatched" || isRecentLibraryAdd),
        // A date of viewing belongs to something you actually finished.
        watched_at: isWatched ? effectiveWatchedAt : null,
        want_to_watch: listContext === "wantToWatch",
        favorite: listContext === "topTen" ? true : favorite,
        priority: listContext === "topTen" ? priority : null,
        priority_level: listContext === "wantToWatch" ? priorityLevel : null,
        seasons:
          defaultType === "serie" || defaultType === "anime" ? seasons : null,
        season_episodes:
          (defaultType === "serie" || defaultType === "anime") && Array.isArray(selectedItem.seasons)
            ? selectedItem.seasons
                .filter((s: any) => s.season_number > 0)
                .map((s: any) => s.episode_count as number)
            : null,
        // [] (not null) for non-series — these columns are NOT NULL DEFAULT '[]'.
        season_posters:
          (defaultType === "serie" || defaultType === "anime") && Array.isArray(selectedItem.seasons)
            ? selectedItem.seasons
                .filter((s: any) => s.season_number > 0)
                .map((s: any) => (s.poster_path ?? null) as string | null)
            : [],
        season_air_dates:
          (defaultType === "serie" || defaultType === "anime") && Array.isArray(selectedItem.seasons)
            ? selectedItem.seasons
                .filter((s: any) => s.season_number > 0)
                .map((s: any) => (s.air_date ?? null) as string | null)
            : [],
        current_episode: isSeries ? (position?.episode ?? (listContext === "inProgress" ? currentEpisode : null)) : null,
        current_season: isSeries ? (position?.season ?? (listContext === "inProgress" ? currentSeason : null)) : null,
        in_progress: isInProgress,
        episodes:
          defaultType === "serie" || defaultType === "anime" ? episodes : null,
        tmdb_id: selectedItem.id,
        tags: genres,
        notes,
        directors: directors || null,
        cast_members: cast ?? [],
        studio: studio || null,
        status: status || null,
      };

      const existing = await getExistingMediaItem(userId, defaultType, selectedItem.id);

      // Single source of truth for what's allowed and which write branch to run
      // (shared with AddMediaModal's conflict banner via resolveTransition).
      const transition = resolveTransition(existing, listContext);
      if (!transition.allowed) {
        const err = new Error(transition.message ?? "Transition not allowed.");
        err.name = "TransitionError";
        throw err;
      }

      switch (transition.action) {
        // in_progress: clear want_to_watch, preserve top10 fields
        case "update:inProgress":
          return updateMediaItem(existing!.id, {
            current_episode: currentEpisode,
            current_season: currentSeason,
            season_episodes:
              (defaultType === "serie" || defaultType === "anime") && Array.isArray(selectedItem.seasons)
                ? selectedItem.seasons
                    .filter((s: any) => s.season_number > 0)
                    .map((s: any) => s.episode_count as number)
                : undefined,
            season_posters:
              (defaultType === "serie" || defaultType === "anime") && Array.isArray(selectedItem.seasons)
                ? selectedItem.seasons
                    .filter((s: any) => s.season_number > 0)
                    .map((s: any) => (s.poster_path ?? null) as string | null)
                : undefined,
            season_air_dates:
              (defaultType === "serie" || defaultType === "anime") && Array.isArray(selectedItem.seasons)
                ? selectedItem.seasons
                    .filter((s: any) => s.season_number > 0)
                    .map((s: any) => (s.air_date ?? null) as string | null)
                : undefined,
            in_progress: true,
            watched: false,
            recently_watched: false,
            want_to_watch: false,
            ...RESET_STATUS,
            priority: existing!.priority,
          });

        // topTen: update top10 fields only, preserve in_progress state entirely
        case "update:topTen":
          return updateMediaItem(existing!.id, {
            watched: true,
            recently_watched: existing!.recently_watched,
            watched_at: existing!.watched_at ?? new Date().toISOString(),
            favorite: true,
            priority,
            user_rating: userRating > 0 ? userRating : null,
            rating: selectedItem.vote_average,
            want_to_watch: false,
            ...RESET_STATUS,
            in_progress: existing!.in_progress ?? false,
            current_episode: existing!.current_episode ?? null,
            current_season: existing!.current_season ?? null,
          });

        // recentlyWatched, library, wantToWatch onto an existing entry
        case "update:merge": {
          const updateData: Record<string, unknown> = { ...insertData };
          if (existing!.priority != null) {
            updateData.priority = existing!.priority;
            updateData.favorite = true;
          }
          if (existing!.recently_watched) {
            updateData.recently_watched = true;
            updateData.watched_at = existing!.watched_at;
          }
          return updateMediaItem(existing!.id, updateData);
        }

        // no existing entry → fresh insert
        default:
          return insertMediaItem(insertData);
      }
    },
    onSuccess: (_, variables) => {
      // refetchType "all" so sections refetch even while inactive — adding from the
      // detail route (e.g. "More Like This") must leave the main-page carousels fresh
      // on Back (Next's Router Cache would otherwise restore them stale).
      queryClient.invalidateQueries({ queryKey: WATCHING_KEYS.all, refetchType: "all" });

      // Remove only the added item from For You cache — refetch only when running low
      const forYouKey = TMDB_KEYS.forYou(variables.defaultType);
      const current = queryClient.getQueryData<{ id: number }[]>(forYouKey) ?? [];
      const updated = current.filter((item) => item.id !== variables.selectedItem.id);
      queryClient.setQueryData(forYouKey, updated);
      if (updated.length < 3) {
        queryClient.invalidateQueries({ queryKey: forYouKey });
      }

      // Cross-module: adding a watched title can move a Goal's progress and
      // auto-tick a Watching-linked habit.
      void syncWatchingGoals(queryClient);
      void syncWatchingHabits(queryClient);
    },
    onError: (error: Error) => {
      if (handledDemoError(error)) return;
      const msg = error.name === "TransitionError"
        ? error.message
        : "Couldn't add this media. Please try again.";
      toast.error(msg);
    },
  });
}
