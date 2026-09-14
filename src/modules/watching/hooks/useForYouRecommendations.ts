import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { dismissForYou, getForYouDismissals, getForYouRecommendations, undismissForYou } from "@/modules/watching/service";
import { useIsDemo } from "@/modules/settings/hooks/useSettings";
import { DemoReadOnlyError, handledDemoError } from "@/shared/utils/demo-guard";
import { toast } from "@/shared/utils/toast";
import { TMDB_KEYS } from "./query-keys";
import type { MediaType } from "@/modules/watching/types";
import { STALE } from "@/shared/lib/stale";

export function useForYouRecommendations(userId: string, type: MediaType) {
  return useQuery({
    queryKey: TMDB_KEYS.forYou(type),
    queryFn: () => getForYouRecommendations(userId, type),
    // ROBOT DATA — the row is rewritten by the `watching-for-you-5d` cron, nothing else. The tier
    // used to be 30 min "because it is cheap", i.e. 240 refetches of a value that changes once
    // every five days. A day is the longest tier under the cadence; a manual refresh invalidates.
    staleTime: STALE.DAY,
    gcTime: STALE.DAY,
    enabled: !!userId,
  });
}

/** Everything you said "no" to — read once, cached like the list it filters. */
export function useForYouDismissals(userId: string, type: MediaType) {
  return useQuery({
    queryKey: TMDB_KEYS.forYouDismissed(type),
    queryFn: () => getForYouDismissals(userId, type),
    staleTime: STALE.DAY,
    gcTime: STALE.DAY,
    enabled: !!userId,
  });
}

/**
 * Dismiss (or take it back). Optimistic: the id joins the cached set at once, so the card slides
 * out on the click, not on the round trip; the robot learns at its next run.
 */
export function useDismissForYou(userId: string, type: MediaType) {
  const queryClient = useQueryClient();
  const isDemo = useIsDemo();
  const key = TMDB_KEYS.forYouDismissed(type);
  return useMutation({
    mutationFn: async ({ tmdbId, undo }: { tmdbId: number; undo?: boolean }) => {
      if (isDemo) throw new DemoReadOnlyError();
      if (undo) await undismissForYou(userId, type, tmdbId);
      else await dismissForYou(userId, type, [tmdbId]);
    },
    onMutate: async ({ tmdbId, undo }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<number[]>(key) ?? [];
      queryClient.setQueryData<number[]>(key, undo ? previous.filter((id) => id !== tmdbId) : [...previous, tmdbId]);
      return { previous };
    },
    onError: (err, _vars, ctx) => {
      if (ctx) queryClient.setQueryData(key, ctx.previous);
      if (handledDemoError(err)) return;
      toast.error("Couldn't save that.");
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });
}
