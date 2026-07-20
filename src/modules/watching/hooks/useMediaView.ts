"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAnimeCours } from "./useAnimeCours";
import { WATCHING_KEYS } from "./query-keys";
import { getAnimeCoursMany } from "../service";
import { buildMediaView, type MediaView, type MediaViewSource } from "../lib/media-view";

/**
 * The lens, wired.
 *
 * A surface asks for a view and gets one — it never has to know that AniList cours exist, which row
 * needs them, or which of the two year columns its title uses. That is the whole point: the overlay
 * stops being something each surface must remember to apply and becomes something it cannot avoid.
 *
 * Fetches nothing for a non-anime (the query is disabled), and degrades to a plain identity view
 * whenever the cours are missing or unresolved — so a title can never render worse than it does now.
 */
export function useMediaView(
  media: (MediaViewSource & { tmdb_id?: number }) | null | undefined,
): MediaView | null {
  const isAnime = media?.type === "anime";
  const tmdbId = media?.tmdb_id ?? 0;
  const expecting = isAnime && tmdbId > 0;
  const { data: coursRow } = useAnimeCours(tmdbId, expecting);
  // `undefined` = the query has not resolved. `null` = it resolved and there are no cours. Only the
  // first is "we don't know yet" — conflating them is what made the position flip after paint.
  const pending = expecting && coursRow === undefined;

  return useMemo(
    () => (media ? buildMediaView(media, coursRow, pending) : null),
    [media, coursRow, pending],
  );
}

type ViewItem = MediaViewSource & { id: string; tmdb_id?: number };

/**
 * Views for a whole LIST, on ONE read.
 *
 * A rail of twenty cards must not become twenty queries — the lens exists to make the overlay free
 * at every surface, not to tax the cheapest ones. One batched fetch keyed by the anime ids on
 * screen, then a view per item, memoised together.
 */
export function useMediaViews(items: ViewItem[] | undefined): Map<string, MediaView> {
  const animeIds = useMemo(
    () => [...new Set((items ?? []).filter((i) => i.type === "anime" && i.tmdb_id).map((i) => i.tmdb_id!))].sort((a, b) => a - b),
    [items],
  );

  const { data: coursMap } = useQuery({
    queryKey: [...WATCHING_KEYS.all, "anime-cours-map", animeIds],
    queryFn: () => getAnimeCoursMany(animeIds),
    enabled: animeIds.length > 0,
    staleTime: 60 * 60 * 1000,   // world facts, not yours
    gcTime: 2 * 60 * 60 * 1000,
  });

  // The whole rail waits on ONE query, so "unknown" is a single fact: the batch has not landed.
  const unresolved = animeIds.length > 0 && coursMap === undefined;

  return useMemo(() => {
    const out = new Map<string, MediaView>();
    for (const item of items ?? []) {
      const expecting = item.type === "anime" && !!item.tmdb_id;
      out.set(
        item.id,
        buildMediaView(
          item,
          item.tmdb_id ? coursMap?.get(item.tmdb_id) : null,
          expecting && unresolved,
        ),
      );
    }
    return out;
  }, [items, coursMap, unresolved]);
}
