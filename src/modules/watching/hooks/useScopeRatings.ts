"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useIsDemo } from "@/modules/settings/hooks/useSettings";
import { DemoReadOnlyError, handledDemoError } from "@/shared/utils/demo-guard";
import { STALE } from "@/shared/lib/stale";
import { getScopeRatingContext, saveScopeRating } from "../service";
import { WATCHING_KEYS } from "./query-keys";

export function useScopeRatings(mediaId: string, enabled = true, tmdbId = 0) {
  const cache = useQueryClient();
  const isDemo = useIsDemo();
  const query = useQuery({ queryKey: [...WATCHING_KEYS.all, "scope-ratings", mediaId],
    queryFn: () => getScopeRatingContext(mediaId), enabled: !!mediaId && enabled,
    staleTime: STALE.MINUTE, gcTime: STALE.HOUR });
  const mutation = useMutation({ mutationFn: (command: Parameters<typeof saveScopeRating>[0]) => {
      if (isDemo) throw new DemoReadOnlyError();
      return saveScopeRating(command);
    }, retry: false,
    onSuccess: async (media) => {
      cache.setQueryData(WATCHING_KEYS.detail(mediaId), media);
      await cache.invalidateQueries({ queryKey: WATCHING_KEYS.all });
    },
    onError: (error) => { if (handledDemoError(error)) return; void cache.invalidateQueries({ queryKey: WATCHING_KEYS.all }); },
  });
  const refresh = () => Promise.all([
    cache.invalidateQueries({ queryKey: WATCHING_KEYS.detail(mediaId) }),
    cache.invalidateQueries({ queryKey: WATCHING_KEYS.animeCours(tmdbId) }),
    cache.invalidateQueries({ queryKey: [...WATCHING_KEYS.all, "scope-ratings", mediaId] }),
  ]);
  return { ...query, refresh, save: mutation.mutateAsync, isSaving: mutation.isPending };
}
