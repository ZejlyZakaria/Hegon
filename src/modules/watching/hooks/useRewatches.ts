"use client";

import { useRef } from "react";
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

export function useAddRewatch(mediaItemId: string, expectedRevision?: number) {
  const queryClient = useQueryClient();
  const isDemo = useIsDemo();
  const ownRevision = useRef<{ id: string; value: number } | null>(null);
  return useMutation({
    retry: false,
    mutationFn: (watchedOn: string) => {
      if (isDemo) throw new DemoReadOnlyError();
      return addRewatch(mediaItemId, watchedOn, Math.max(expectedRevision ?? 0, ownRevision.current?.id === mediaItemId ? ownRevision.current.value : 0, queryClient.getQueryData<{ personal_revision?: number }>(WATCHING_KEYS.detail(mediaItemId))?.personal_revision ?? 0));
    },
    onSuccess: (saved) => {
      if (saved.personal_revision !== undefined) ownRevision.current = { id: mediaItemId, value: saved.personal_revision };
      queryClient.setQueryData(WATCHING_KEYS.detail(mediaItemId), saved);
      queryClient.invalidateQueries({ queryKey: WATCHING_KEYS.detail(mediaItemId) });
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
      queryClient.invalidateQueries({ queryKey: WATCHING_KEYS.detail(mediaItemId) });
      queryClient.invalidateQueries({ queryKey: WATCHING_KEYS.rewatches(mediaItemId) });
      // Rewatches feed Hours Watched + the Rewatches stat → keep Stats live.
      queryClient.invalidateQueries({ queryKey: [...WATCHING_KEYS.all, "stats"] });
    },
    onError: handledDemoError,
  });
}
