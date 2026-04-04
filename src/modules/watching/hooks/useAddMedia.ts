/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { WATCHING_KEYS } from "./query-keys";
import {
  getCurrentUserId,
  getExistingMediaItem,
  insertMediaItem,
  updateMediaItemById,
} from "../service";
import type { MediaType } from "../types";

type ListType =
  | "topTen"
  | "inProgress"
  | "recentlyWatched"
  | "wantToWatch"
  | "library";

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
  directors: { name: string; profile_url: string | null }[] | null;
  studio: string | null;
  status: string | null;
  customPosterUrl?: string | null;
  genres: string[];
}

export function useAddMedia() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: AddMediaInput) => {
      const userId = await getCurrentUserId();

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
        studio,
        status,
        customPosterUrl,
        genres,
      } = input;

      const posterUrl =
        customPosterUrl ||
        (selectedItem.poster_path
          ? `https://image.tmdb.org/t/p/w500${selectedItem.poster_path}`
          : null);

      const insertData = {
        user_id: userId,
        type: defaultType,
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
        watched:
          listContext === "recentlyWatched" ||
          listContext === "topTen" ||
          listContext === "library",
        recently_watched: listContext === "recentlyWatched",
        watched_at:
          listContext === "recentlyWatched" || listContext === "topTen"
            ? new Date().toISOString()
            : null,
        want_to_watch: listContext === "wantToWatch",
        favorite: listContext === "topTen" ? true : favorite,
        priority: listContext === "topTen" ? priority : null,
        priority_level: listContext === "wantToWatch" ? priorityLevel : null,
        seasons:
          defaultType === "serie" || defaultType === "anime" ? seasons : null,
        current_episode: listContext === "inProgress" ? currentEpisode : null,
        current_season: listContext === "inProgress" ? currentSeason : null,
        in_progress: listContext === "inProgress",
        episodes:
          defaultType === "serie" || defaultType === "anime" ? episodes : null,
        tmdb_id: selectedItem.id,
        tags: genres,
        notes,
        directors: directors || null,
        studio: studio || null,
        status: status || null,
      };

      const existing = await getExistingMediaItem(userId, defaultType, selectedItem.id);

      if (existing?.id) {
        if (listContext === "inProgress") {
          return updateMediaItemById(existing.id, {
            current_episode: currentEpisode,
            current_season: currentSeason,
            in_progress: true,
            watched: false,
            recently_watched: false,
            want_to_watch: false,
            priority: existing.priority,
          });
        }

        const updateData: any = { ...insertData };
        if (listContext !== "topTen" && existing.priority != null) {
          updateData.priority = existing.priority;
          updateData.favorite = true;
        }
        if (listContext === "topTen" && existing.recently_watched) {
          updateData.recently_watched = true;
          updateData.watched_at = existing.watched_at;
        }
        return updateMediaItemById(existing.id, updateData);
      }

      return insertMediaItem(insertData);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: WATCHING_KEYS.all });

      const typeMap = {
        film: WATCHING_KEYS.movies,
        serie: WATCHING_KEYS.series,
        anime: WATCHING_KEYS.animes,
      };
      const typeKey = typeMap[variables.defaultType];
      if (typeKey) {
        queryClient.invalidateQueries({ queryKey: typeKey() });
      }
    },
    onError: (error) => {
      console.error("Error adding media:", error);
    },
  });
}
