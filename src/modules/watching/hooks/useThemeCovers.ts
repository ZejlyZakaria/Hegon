"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { searchItunesArtwork } from "../service";

// Resolves the square cover for a set of themes (title+artist) in one query, using
// the exact same iTunes lookup + cache as the detail panel — so "My Themes" always
// shows the identical image (no switch between surfaces). Returns a
// { "title|artist" -> coverUrl|null } map. Cheap: hits the shared persistent cache.
export function useThemeCovers(items: { title: string; artist: string }[]) {
  const unique = useMemo(() => {
    const map = new Map<string, { title: string; artist: string }>();
    for (const i of items) map.set(`${i.title}|${i.artist}`, i);
    return [...map.values()];
  }, [items]);

  return useQuery({
    queryKey: ["theme-covers", unique.map((i) => `${i.title}|${i.artist}`)],
    queryFn: async () => {
      const entries = await Promise.all(
        unique.map(async (i) => [`${i.title}|${i.artist}`, await searchItunesArtwork(i.title, i.artist)] as const),
      );
      return Object.fromEntries(entries) as Record<string, string | null>;
    },
    enabled: unique.length > 0,
    staleTime: 7 * 24 * 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  });
}
