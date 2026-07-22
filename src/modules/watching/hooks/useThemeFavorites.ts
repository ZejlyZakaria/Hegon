"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getThemeFavorites, addThemeFavorite, removeThemeFavorite, themeTrackKey } from "../service";
import type { ThemeFavorite } from "../types";
import type { PlayerTrack } from "../store/theme-player";
import { WATCHING_KEYS } from "./query-keys";
import { useIsDemo } from "@/modules/settings/hooks/useSettings";
import { DemoReadOnlyError, handledDemoError } from "@/shared/utils/demo-guard";

// The user's hearted OP/ED, durable in Supabase (was localStorage). Source of
// truth for the ♥ state on every row/player and for the "My Themes" playlist.
//
// `enabled` exists for ONE caller: the ThemePlayer lives in the Watching layout, so it mounts on
// every page of the module and used to pull the whole playlist — 8151 bytes measured, on 6 hard
// loads out of 6 — even though it renders nothing at all until a track is playing. The three
// surfaces that actually SHOW themes keep asking unconditionally; they display the list.
export function useThemeFavorites(enabled = true) {
  return useQuery({
    queryKey: WATCHING_KEYS.themeFavorites(),
    queryFn: getThemeFavorites,
    staleTime: 5 * 60 * 1000,
    enabled,
  });
}

// Toggle a track's favorite state with an optimistic flip (the heart reacts
// instantly; a demo user's flip is rolled back with a friendly notice).
export function useToggleThemeFavorite() {
  const queryClient = useQueryClient();
  const isDemo = useIsDemo();
  const key = WATCHING_KEYS.themeFavorites();

  return useMutation({
    mutationFn: async ({ track, faved }: { track: PlayerTrack; faved: boolean }) => {
      if (isDemo) throw new DemoReadOnlyError();
      if (faved) await removeThemeFavorite(themeTrackKey(track));
      else await addThemeFavorite(track);
    },
    onMutate: async ({ track, faved }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const prev = queryClient.getQueryData<ThemeFavorite[]>(key) ?? [];
      const tk = themeTrackKey(track);
      const next: ThemeFavorite[] = faved
        ? prev.filter((f) => f.track_key !== tk)
        : [
            {
              id: `optimistic-${tk}`,
              track_key: tk,
              anime_name: track.animeName,
              label: track.label,
              title: track.title,
              artist: track.artist,
              audio_url: track.audioUrl,
              video_url: track.videoUrl,
              cover: track.cover,
              anime_poster: track.animePoster,
              media_tmdb_id: null,
              created_at: new Date().toISOString(),
            },
            ...prev,
          ];
      queryClient.setQueryData(key, next);
      return { prev };
    },
    onError: (e, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(key, ctx.prev);
      handledDemoError(e);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key });
    },
  });
}
