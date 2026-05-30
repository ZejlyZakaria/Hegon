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
  updateMediaList,
  updateListItemNote,
  searchMediaForList,
  searchTmdbForList,
  addTmdbItemToList,
} from "../service";
import type { TmdbListResult } from "../types";
import { WATCHING_KEYS } from "./query-keys";

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
  return useMutation({
    mutationFn: (name: string) => createMediaList(name, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WATCHING_KEYS.lists(userId) });
    },
  });
}

export function useAddToList(mediaItemId: string, userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (listId: string) => addMediaToList(listId, mediaItemId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WATCHING_KEYS.listsForMedia(mediaItemId) });
    },
  });
}

export function useRemoveFromList(mediaItemId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (listId: string) => removeMediaFromList(listId, mediaItemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WATCHING_KEYS.listsForMedia(mediaItemId) });
    },
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
  return useMutation({
    mutationFn: (listId: string) => deleteMediaList(listId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WATCHING_KEYS.lists(userId) });
    },
  });
}

export function useUpdateMediaList(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; emoji?: string | null; description?: string | null; is_ranked?: boolean } }) =>
      updateMediaList(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WATCHING_KEYS.lists(userId) });
    },
  });
}

export function useUpdateListItemNote(listId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ listItemId, note }: { listItemId: string; note: string | null }) =>
      updateListItemNote(listItemId, note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WATCHING_KEYS.listItems(listId) });
    },
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
  return useMutation({
    mutationFn: (mediaItemId: string) => addMediaToList(listId, mediaItemId, userId),
    onSuccess: (_, mediaItemId) => {
      queryClient.invalidateQueries({ queryKey: WATCHING_KEYS.listItems(listId) });
      queryClient.invalidateQueries({ queryKey: WATCHING_KEYS.listsForMedia(mediaItemId) });
      queryClient.invalidateQueries({ queryKey: [...WATCHING_KEYS.all, "lists"] });
    },
  });
}

export function useRemoveItemFromList(listId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ mediaItemId }: { mediaItemId: string }) =>
      removeMediaFromList(listId, mediaItemId),
    onSuccess: (_, { mediaItemId }) => {
      queryClient.invalidateQueries({ queryKey: WATCHING_KEYS.listItems(listId) });
      queryClient.invalidateQueries({ queryKey: WATCHING_KEYS.listsForMedia(mediaItemId) });
      queryClient.invalidateQueries({ queryKey: [...WATCHING_KEYS.all, "lists"] });
    },
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

export function useAddTmdbItemToList(listId: string, userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tmdbItem: TmdbListResult) => addTmdbItemToList(listId, userId, tmdbItem),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: WATCHING_KEYS.listItems(listId) });
      queryClient.invalidateQueries({ queryKey: WATCHING_KEYS.listsForMedia(data.media_item_id) });
      queryClient.invalidateQueries({ queryKey: [...WATCHING_KEYS.all, "lists"] });
    },
  });
}
