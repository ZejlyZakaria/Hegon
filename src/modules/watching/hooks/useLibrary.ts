import { useQuery } from "@tanstack/react-query";
import { WATCHING_KEYS } from "./query-keys";
import { getLibraryMedia } from "../service";
import type { WatchingMedia } from "../types";

// Live Library query. Seeded with the server-fetched list (initialData) and keyed
// under WATCHING_KEYS, so every watching mutation's invalidation (WATCHING_KEYS.all)
// refreshes it — cross-surface adds/deletes show immediately, regardless of the
// Next.js RSC router cache.
export function useLibrary(userId: string, initialData?: WatchingMedia[]) {
  return useQuery({
    queryKey: WATCHING_KEYS.library(userId),
    queryFn: () => getLibraryMedia(userId),
    initialData,
    staleTime: 30 * 1000,
  });
}
