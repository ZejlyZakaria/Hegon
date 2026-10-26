"use client";
import { syncWatchingGoals } from "../lib/sync-goals";

import { useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getRewatches, addRewatch, removeRewatch } from "../service";
import type { RewatchRequest, RewatchCatalogue } from "../lib/rewatch";
import { STALE } from "@/shared/lib/stale";
import { WATCHING_KEYS } from "./query-keys";
import { useIsDemo } from "@/modules/settings/hooks/useSettings";
import { DemoReadOnlyError, handledDemoError } from "@/shared/utils/demo-guard";

export function useRewatches(mediaItemId: string) {
  return useQuery({
    queryKey: WATCHING_KEYS.rewatches(mediaItemId),
    queryFn: () => getRewatches(mediaItemId),
    enabled: !!mediaItemId,
    staleTime: STALE.MINUTE, gcTime: STALE.HOUR,
  });
}

export function useAddRewatch(mediaItemId: string, expectedRevision?: number) {
  const queryClient = useQueryClient();
  const isDemo = useIsDemo();
  const ownRevision = useRef<{ id: string; value: number } | null>(null);
  return useMutation({
    retry: false,
    mutationFn: ({request,catalogue}: {request:RewatchRequest;catalogue:RewatchCatalogue}) => {
      if (isDemo) throw new DemoReadOnlyError();
      return addRewatch(mediaItemId, request, Math.max(expectedRevision ?? 0, ownRevision.current?.id === mediaItemId ? ownRevision.current.value : 0, queryClient.getQueryData<{ personal_revision?: number }>(WATCHING_KEYS.detail(mediaItemId))?.personal_revision ?? 0), catalogue);
    },
    onSuccess: (saved) => {
      if (saved.personal_revision !== undefined) ownRevision.current = { id: mediaItemId, value: saved.personal_revision };
      queryClient.setQueryData(WATCHING_KEYS.detail(mediaItemId), saved);
      void syncWatchingGoals(queryClient);
      queryClient.invalidateQueries({ queryKey: WATCHING_KEYS.all });
      queryClient.invalidateQueries({ queryKey: WATCHING_KEYS.rewatches(mediaItemId) });
      // Rewatches feed Hours Watched + the Rewatches stat → keep Stats live.
      queryClient.invalidateQueries({ queryKey: [...WATCHING_KEYS.all, "stats"] });
    },
    onError: handledDemoError,
  });
}

export function useRemoveRewatch(mediaItemId: string, expectedRevision?: number) {
  const queryClient = useQueryClient();
  const isDemo = useIsDemo();
  const ownRevision = useRef<{ id: string; value: number } | null>(null);
  return useMutation({
    retry: false,
    mutationFn: (id: string) => {
      if (isDemo) throw new DemoReadOnlyError();
      return removeRewatch(id, Math.max(expectedRevision ?? 0, ownRevision.current?.id === mediaItemId ? ownRevision.current.value : 0, queryClient.getQueryData<{ personal_revision?: number }>(WATCHING_KEYS.detail(mediaItemId))?.personal_revision ?? 0));
    },
    onSuccess: (saved) => {
      if (saved.personal_revision !== undefined) ownRevision.current = { id: mediaItemId, value: saved.personal_revision };
      queryClient.setQueryData(WATCHING_KEYS.detail(mediaItemId), saved);
      void syncWatchingGoals(queryClient);
      queryClient.invalidateQueries({ queryKey: WATCHING_KEYS.all });
      queryClient.invalidateQueries({ queryKey: WATCHING_KEYS.rewatches(mediaItemId) });
      // Rewatches feed Hours Watched + the Rewatches stat → keep Stats live.
      queryClient.invalidateQueries({ queryKey: [...WATCHING_KEYS.all, "stats"] });
    },
    onError: handledDemoError,
  });
}
