"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getMediaLists,
  getListsForMedia,
  getListItems,
  getListsWithThumbnails,
  createMediaList,
  addMediaToList,
  removeMediaFromList,
  deleteMediaList,
  restoreMediaList,
  updateMediaList,
  updateListItemNote,
  searchMediaForList,
  searchTmdbForList,
  searchCatalogue,
  addTmdbItemToList,
} from "../service";
import type { TmdbListResult } from "../types";
import { WATCHING_KEYS } from "./query-keys";
import { useIsDemo } from "@/modules/settings/hooks/useSettings";
import { DemoReadOnlyError, handledDemoError } from "@/shared/utils/demo-guard";

export function useMediaLists(userId: string) {
  return useQuery({
    queryKey: WATCHING_KEYS.lists(userId),
    queryFn: () => getMediaLists(userId),
    enabled: !!userId,
  });
}

export function useListsForMedia(mediaItemId: string) {
  return useQuery({
    queryKey: WATCHING_KEYS.listsForMedia(mediaItemId),
    queryFn: () => getListsForMedia(mediaItemId),
    enabled: !!mediaItemId,
  });
}

export function useCreateMediaList(userId: string) {
  const queryClient = useQueryClient();
  const isDemo = useIsDemo();
  return useMutation({
    mutationFn: (name: string) => {
      if (isDemo) throw new DemoReadOnlyError();
      return createMediaList(name, userId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WATCHING_KEYS.lists(userId) });
    },
    onError: handledDemoError,
  });
}

export function useAddToList(mediaItemId: string, userId: string) {
  const queryClient = useQueryClient();
  const isDemo = useIsDemo();
  return useMutation({
    mutationFn: (listId: string) => {
      if (isDemo) throw new DemoReadOnlyError();
      return addMediaToList(listId, mediaItemId, userId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WATCHING_KEYS.listsForMedia(mediaItemId) });
    },
    onError: handledDemoError,
  });
}

export function useRemoveFromList(mediaItemId: string) {
  const queryClient = useQueryClient();
  const isDemo = useIsDemo();
  return useMutation({
    mutationFn: (listId: string) => {
      if (isDemo) throw new DemoReadOnlyError();
      return removeMediaFromList(listId, mediaItemId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WATCHING_KEYS.listsForMedia(mediaItemId) });
    },
    onError: handledDemoError,
  });
}

export function useListsWithThumbnails(userId: string) {
  return useQuery({
    queryKey: [...WATCHING_KEYS.lists(userId), "thumbnails"],
    queryFn: () => getListsWithThumbnails(userId),
    enabled: !!userId,
  });
}

export function useListItems(listId: string) {
  return useQuery({
    queryKey: WATCHING_KEYS.listItems(listId),
    queryFn: () => getListItems(listId),
    enabled: !!listId,
  });
}

export function useDeleteMediaList(userId: string) {
  const queryClient = useQueryClient();
  const isDemo = useIsDemo();
  return useMutation({
    mutationFn: (listId: string) => {
      if (isDemo) throw new DemoReadOnlyError();
      return deleteMediaList(listId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WATCHING_KEYS.lists(userId) });
    },
    onError: handledDemoError,
  });
}

/** Undo a list deletion. The row and its items never left — they were only hidden. */
export function useRestoreMediaList(userId: string) {
  const queryClient = useQueryClient();
  const isDemo = useIsDemo();
  return useMutation({
    mutationFn: (listId: string) => {
      if (isDemo) throw new DemoReadOnlyError();
      return restoreMediaList(listId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WATCHING_KEYS.lists(userId) });
    },
    onError: handledDemoError,
  });
}

export function useUpdateMediaList(userId: string) {
  const queryClient = useQueryClient();
  const isDemo = useIsDemo();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; emoji?: string | null; description?: string | null; is_ranked?: boolean } }) => {
      if (isDemo) throw new DemoReadOnlyError();
      return updateMediaList(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WATCHING_KEYS.lists(userId) });
    },
    onError: handledDemoError,
  });
}

export function useUpdateListItemNote(listId: string) {
  const queryClient = useQueryClient();
  const isDemo = useIsDemo();
  return useMutation({
    mutationFn: ({ listItemId, note }: { listItemId: string; note: string | null }) => {
      if (isDemo) throw new DemoReadOnlyError();
      return updateListItemNote(listItemId, note);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WATCHING_KEYS.listItems(listId) });
    },
    onError: handledDemoError,
  });
}

export function useSearchMediaForList(userId: string, query: string) {
  return useQuery({
    queryKey: [...WATCHING_KEYS.all, "search-for-list", userId, query],
    queryFn: () => searchMediaForList(userId, query),
    enabled: !!userId && query.trim().length >= 2,
    staleTime: 30_000,
  });
}

export function useAddItemToList(listId: string, userId: string) {
  const queryClient = useQueryClient();
  const isDemo = useIsDemo();
  return useMutation({
    mutationFn: (mediaItemId: string) => {
      if (isDemo) throw new DemoReadOnlyError();
      return addMediaToList(listId, mediaItemId, userId);
    },
    onSuccess: (_, mediaItemId) => {
      queryClient.invalidateQueries({ queryKey: WATCHING_KEYS.listItems(listId) });
      queryClient.invalidateQueries({ queryKey: WATCHING_KEYS.listsForMedia(mediaItemId) });
      queryClient.invalidateQueries({ queryKey: [...WATCHING_KEYS.all, "lists"] });
    },
    onError: handledDemoError,
  });
}

export function useRemoveItemFromList(listId: string) {
  const queryClient = useQueryClient();
  const isDemo = useIsDemo();
  return useMutation({
    mutationFn: ({ mediaItemId }: { mediaItemId: string }) => {
      if (isDemo) throw new DemoReadOnlyError();
      return removeMediaFromList(listId, mediaItemId);
    },
    onSuccess: (_, { mediaItemId }) => {
      queryClient.invalidateQueries({ queryKey: WATCHING_KEYS.listItems(listId) });
      queryClient.invalidateQueries({ queryKey: WATCHING_KEYS.listsForMedia(mediaItemId) });
      queryClient.invalidateQueries({ queryKey: [...WATCHING_KEYS.all, "lists"] });
    },
    onError: handledDemoError,
  });
}

export function useSearchTmdbForList(query: string) {
  return useQuery({
    queryKey: [...WATCHING_KEYS.all, "tmdb-list-search", query],
    queryFn: () => searchTmdbForList(query),
    enabled: query.trim().length >= 2,
    staleTime: 60_000,
  });
}

/** The Watching header search: titles + people from one /search/multi call, in relevance order. */
export function useSearchCatalogue(query: string) {
  return useQuery({
    queryKey: [...WATCHING_KEYS.all, "catalogue-search", query],
    queryFn: () => searchCatalogue(query),
    enabled: query.trim().length >= 2,
    staleTime: 60_000,
  });
}

export function useAddTmdbItemToList(listId: string, userId: string) {
  const queryClient = useQueryClient();
  const isDemo = useIsDemo();
  return useMutation({
    mutationFn: (tmdbItem: TmdbListResult) => {
      if (isDemo) throw new DemoReadOnlyError();
      return addTmdbItemToList(listId, userId, tmdbItem);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: WATCHING_KEYS.listItems(listId) });
      queryClient.invalidateQueries({ queryKey: WATCHING_KEYS.listsForMedia(data.media_item_id) });
      queryClient.invalidateQueries({ queryKey: [...WATCHING_KEYS.all, "lists"] });
    },
    onError: handledDemoError,
  });
}
