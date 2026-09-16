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
import type { ListType, MediaType, TmdbListResult } from "../types";
import { STALE } from "@/shared/lib/stale";

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

  const addResolved = useCallback(
    async (
      id: number,
      type: MediaType,
      listContext: ListType,
      priorityLevel: "high" | "medium" | "low",
    ) => {
      const tmdbType = type === "film" ? "movie" : "tv";
      const isSeries = type !== "film";

      // The bundle carries seasons + runtime samples but NOT credits (measured −165 KB); credits are
      // their own cached read, keyed exactly as useMediaCredits so the fiche reuses it. Cours only
      // for anime, to place the lens in display space.
      const [bundle, credits, coursRow] = await Promise.all([
        queryClient.fetchQuery({
          queryKey: TMDB_KEYS.bundle(type, id),
          queryFn: () => getTitleBundle(id, tmdbType),
          staleTime: STALE.DAY,
          gcTime: STALE.DAY,
        }),
        queryClient.fetchQuery({
          queryKey: TMDB_KEYS.credits(type, id),
          queryFn: async () => mapCredits(await getMediaDetails(id, tmdbType), type),
          staleTime: STALE.DAY,
          gcTime: STALE.DAY,
        }),
        type === "anime" ? getAnimeCours(id) : Promise.resolve(null),
      ]);

      const media = mapTmdbDetails(bundle, id, type);
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

  const add = useCallback(
    (result: TmdbListResult, listContext: ListType, priorityLevel: "high" | "medium" | "low" = "medium") =>
      addResolved(result.id, tmdbResultType(result), listContext, priorityLevel),
    [addResolved],
  );

  /**
   * The « + » on a poster (More Like This, a person's credits, the Museum): the surface knows a
   * TMDB id and a kind, not a search row. A `serie` hint is not trusted — to Wikidata and to a
   * filmography every anime is a TV series — so the bundle decides, by the same rule the search
   * results use (animation from JP/KR/CN). A film needs no second look.
   */
  const addByTmdb = useCallback(
    async (id: number, hint: MediaType, listContext: ListType = "wantToWatch", priorityLevel: "high" | "medium" | "low" = "medium") => {
      let type = hint;
      if (hint === "serie") {
        const bundle = await queryClient.fetchQuery({
          queryKey: TMDB_KEYS.bundle("serie", id),
          queryFn: () => getTitleBundle(id, "tv"),
          staleTime: STALE.DAY,
          gcTime: STALE.DAY,
        });
        type = tmdbResultType({
          media_type: "tv",
          genre_ids: Array.isArray(bundle.genres) ? bundle.genres.map((g: { id: number }) => g.id) : [],
          origin_country: Array.isArray(bundle.origin_country) ? bundle.origin_country : [],
        });
      }
      return addResolved(id, type, listContext, priorityLevel);
    },
    [queryClient, addResolved],
  );

  return { add, addByTmdb };
}
