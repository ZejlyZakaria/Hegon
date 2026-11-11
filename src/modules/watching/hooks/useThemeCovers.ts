"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { resolveThemeCovers } from "../service";
import { WATCHING_KEYS } from "./query-keys";
import { STALE } from "@/shared/lib/stale";

// Resolves the square cover for a set of themes (title+artist) in one query, using
// the exact same iTunes lookup + cache as the detail panel — so "My Themes" always
// shows the identical image (no switch between surfaces). Returns a
// { "title|artist" -> coverUrl|null } map. Cheap: hits the shared persistent cache.
export function useThemeCovers(items: { title: string; artist: string }[]) {
  const unique = useMemo(() => {
    const map = new Map<string, { title: string; artist: string }>();
    for (const i of items) map.set(`${i.title}|${i.artist}`, i);
    return [...map.values()].sort((a,b)=>`${a.title}|${a.artist}`.localeCompare(`${b.title}|${b.artist}`));
  }, [items]);

  return useQuery({
    queryKey: WATCHING_KEYS.themeCovers(unique.map((i) => `${i.title}|${i.artist}`)),
    queryFn: () => resolveThemeCovers(unique),
    retry: false,
    enabled: unique.length > 0,
    staleTime: STALE.DAY,
    gcTime: STALE.DAY,
  });
}
