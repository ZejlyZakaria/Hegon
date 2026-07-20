"use client";

import { useMemo } from "react";
import { useAnimeCours } from "./useAnimeCours";
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
  const { data: coursRow } = useAnimeCours(tmdbId, isAnime && tmdbId > 0);

  return useMemo(
    () => (media ? buildMediaView(media, coursRow) : null),
    [media, coursRow],
  );
}
