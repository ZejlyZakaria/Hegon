"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getRewatches, addRewatch, removeRewatch } from "../service";
import { WATCHING_KEYS } from "./query-keys";
import { useIsDemo } from "@/modules/settings/hooks/useSettings";
import { DemoReadOnlyError, handledDemoError } from "@/shared/utils/demo-guard";

export function useRewatches(mediaItemId: string) {
  return useQuery({
    queryKey: WATCHING_KEYS.rewatches(mediaItemId),
    queryFn: () => getRewatches(mediaItemId),
    enabled: !!mediaItemId,
  });
}

export function useAddRewatch(mediaItemId: string) {
  const queryClient = useQueryClient();
  const isDemo = useIsDemo();
  return useMutation({
    mutationFn: (watchedOn: string) => {
      if (isDemo) throw new DemoReadOnlyError();
      return addRewatch(mediaItemId, watchedOn);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WATCHING_KEYS.rewatches(mediaItemId) });
      // Rewatches feed Hours Watched + the Rewatches stat → keep Stats live.
      queryClient.invalidateQueries({ queryKey: [...WATCHING_KEYS.all, "stats"] });
    },
    onError: handledDemoError,
  });
}

export function useRemoveRewatch(mediaItemId: string) {
  const queryClient = useQueryClient();
  const isDemo = useIsDemo();
  return useMutation({
    mutationFn: (id: string) => {
      if (isDemo) throw new DemoReadOnlyError();
      return removeRewatch(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WATCHING_KEYS.rewatches(mediaItemId) });
      // Rewatches feed Hours Watched + the Rewatches stat → keep Stats live.
      queryClient.invalidateQueries({ queryKey: [...WATCHING_KEYS.all, "stats"] });
    },
    onError: handledDemoError,
  });
}
