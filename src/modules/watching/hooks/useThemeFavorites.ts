"use client";

import { useOrgStore } from "@/shared/stores/useOrgStore";
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
  const orgId=useOrgStore(s=>s.orgId);
  return useQuery({
    queryKey: WATCHING_KEYS.themeFavorites(orgId),
    queryFn: () => { if (!orgId) throw new Error("Organization required"); return getThemeFavorites(orgId); },
    enabled: enabled && !!orgId,
  });
}

// Toggle a track's favorite state with an optimistic flip (the heart reacts
// instantly; a demo user's flip is rolled back with a friendly notice).
export function useToggleThemeFavorite() {
  const queryClient = useQueryClient();
  const isDemo = useIsDemo();
  const orgId=useOrgStore(s=>s.orgId);
  const mutation = useMutation({
    mutationFn: async ({ track, faved, organizationId }: { track: PlayerTrack; faved: boolean; organizationId: string|null }) => {
      if (isDemo) throw new DemoReadOnlyError();
      if (!organizationId) throw new Error("Organization required");
      if (faved) await removeThemeFavorite(themeTrackKey(track),organizationId);
      else await addThemeFavorite(track,organizationId);
    },
    onMutate: async ({ track, faved, organizationId }) => {
      const key=WATCHING_KEYS.themeFavorites(organizationId);
      await queryClient.cancelQueries({ queryKey: key });
      const prev = queryClient.getQueryData<ThemeFavorite[]>(key);
      if (!prev) return { prev, key };
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
      return { prev, key };
    },
    onError: (e, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(ctx.key, ctx.prev);
      handledDemoError(e);
    },
    onSettled: (_data, _error, variables, ctx) => {
      queryClient.invalidateQueries({ queryKey: ctx?.key ?? WATCHING_KEYS.themeFavorites(variables.organizationId) });
    },
  });
  // Freeze the workspace in mutation variables, including while another workspace is selected.
  return {
    ...mutation,
    mutate: (input: {track:PlayerTrack;faved:boolean}) => mutation.mutate({...input,organizationId:orgId}),
    mutateAsync: (input: {track:PlayerTrack;faved:boolean}) => mutation.mutateAsync({...input,organizationId:orgId}),
  };
}
