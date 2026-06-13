"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { updateMediaItem } from "../service";
import { WATCHING_KEYS } from "./query-keys";
import { useIsDemo } from "@/modules/settings/hooks/useSettings";
import type { WatchingMedia } from "../types";

// Lazily refresh per-season data (episodes / posters / air_dates) from TMDB for
// ONGOING series/anime when their detail page opens — so new or just-released
// seasons appear, and "Coming soon" flips to editable, without a manual backfill.
// Ended shows are frozen. Writes only when something actually changed.
export function useSeasonRefresh(media: WatchingMedia | null | undefined) {
  const queryClient = useQueryClient();
  const isDemo = useIsDemo();
  const doneRef = useRef<string | null>(null);

  useEffect(() => {
    if (!media || isDemo) return;
    if (media.type === "film" || media.status !== "ongoing" || !media.tmdb_id) return;
    if (doneRef.current === media.id) return; // once per media
    doneRef.current = media.id;

    (async () => {
      try {
        const res = await fetch(`/api/tmdb?endpoint=tv/${media.tmdb_id}&language=en-US`);
        if (!res.ok) return;
        const tv = await res.json();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const real = (tv.seasons ?? []).filter((s: any) => s.season_number > 0);
        if (real.length === 0) return;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const seasonEpisodes  = real.map((s: any) => s.episode_count ?? 0);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const seasonPosters   = real.map((s: any) => s.poster_path ?? null);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const seasonAirDates  = real.map((s: any) => s.air_date ?? null);

        const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
        const unchanged =
          eq(seasonEpisodes, media.season_episodes ?? []) &&
          eq(seasonPosters,  media.season_posters ?? []) &&
          eq(seasonAirDates, media.season_air_dates ?? []);
        if (unchanged) return;

        await updateMediaItem(media.id, {
          season_episodes: seasonEpisodes,
          season_posters: seasonPosters,
          season_air_dates: seasonAirDates,
          seasons: seasonEpisodes.length,
          episodes: seasonEpisodes.reduce((a: number, b: number) => a + b, 0),
        });
        queryClient.invalidateQueries({ queryKey: WATCHING_KEYS.detail(media.id) });
      } catch {
        /* best-effort background refresh */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [media?.id, media?.status]);
}
