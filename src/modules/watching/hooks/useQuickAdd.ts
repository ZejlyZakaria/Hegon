"use client";

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { TMDB_KEYS } from "./query-keys";
import { useAddMedia } from "./useAddMedia";
import { mapCredits } from "./useMediaCredits";
import {
  getTitleBundle,
  getMediaDetails,
  getAnimeCours,
  mapTmdbDetails,
  tmdbResultType,
} from "../service";
import { buildMediaView } from "../lib/media-view";
import type { ListType, TmdbListResult } from "../types";

const DAY = 24 * 60 * 60 * 1000;

// The far end of what has AIRED, in storage coordinates — the honest "mark as watched" position for
// a series. Same rule the discover page uses; a running show lands caught-up, a finished one watched.
function lastAiredPosition(aired: number[] | null | undefined): { season: number; episode: number } | null {
  const list = aired ?? [];
  for (let i = list.length - 1; i >= 0; i--) {
    const n = list[i] ?? 0;
    if (n > 0) return { season: i + 1, episode: n };
  }
  return null;
}

/**
 * ADD A SEARCH RESULT, NO FORM. The quick-add panel hands over a lean TMDB search row and an intent
 * (the destination chip); this fetches the full title exactly like the discover page's buttons do —
 * the bundle (seasons + real per-episode runtimes via `season/1`) and the credits (cast/directors,
 * which the bundle deliberately omits) — builds the same payload, and adds. The status is DERIVED
 * from the intent + how far the title has aired, never asserted: nothing here can mark a running
 * series "watched". Everything else (rating, exact position, Top 10 rank) is refined on the fiche.
 */
export function useQuickAdd() {
  const queryClient = useQueryClient();
  const addMedia = useAddMedia();

  const add = useCallback(
    async (
      result: TmdbListResult,
      listContext: ListType,
      priorityLevel: "high" | "medium" | "low" = "medium",
    ) => {
      const type = tmdbResultType(result);
      const tmdbType = type === "film" ? "movie" : "tv";
      const isSeries = type !== "film";

      // The bundle carries seasons + runtime samples but NOT credits (measured −165 KB); credits are
      // their own cached read, keyed exactly as useMediaCredits so the fiche reuses it. Cours only
      // for anime, to place the lens in display space.
      const [bundle, credits, coursRow] = await Promise.all([
        queryClient.fetchQuery({
          queryKey: TMDB_KEYS.bundle(type, result.id),
          queryFn: () => getTitleBundle(result.id, tmdbType),
          staleTime: DAY,
        }),
        queryClient.fetchQuery({
          queryKey: TMDB_KEYS.credits(type, result.id),
          queryFn: async () => mapCredits(await getMediaDetails(result.id, tmdbType), type),
          staleTime: DAY,
        }),
        type === "anime" ? getAnimeCours(result.id) : Promise.resolve(null),
      ]);

      const media = mapTmdbDetails(bundle, result.id, type);
      if (!media) throw new Error("Couldn't load this title.");

      const view = buildMediaView(
        {
          type,
          status: media.status,
          caught_up_at: null,
          episodes: undefined,
          season_episodes: media.season_episodes ?? null,
          season_aired: media.season_aired ?? null,
          season_posters: null,
          season_end_dates: null,
          current_season: undefined,
          current_episode: undefined,
          season_years: null,
          season_ratings: null,
          cour_years: null,
          cour_ratings: null,
        },
        coursRow ?? undefined,
      );

      const position =
        listContext === "inProgress"
          ? { season: 1, episode: 1 }
          : listContext === "recentlyWatched" && isSeries
            ? lastAiredPosition(media.season_aired)
            : null;

      return addMedia.mutateAsync({
        selectedItem: bundle,
        defaultType: type,
        listContext,
        userRating: 0,
        notes: "",
        favorite: false,
        priority: null,
        priorityLevel,
        seasons: media.seasons ?? null,
        episodes: media.episodes ?? null,
        runtime: media.runtime,
        directors: credits.directors,
        cast: credits.cast,
        studio: media.studio ?? null,
        status: media.status ?? null,
        genres: media.tags ?? [],
        position,
        stance: "watching",
        view,
      });
    },
    [queryClient, addMedia],
  );

  return { add };
}
