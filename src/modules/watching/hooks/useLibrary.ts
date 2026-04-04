import { useQuery } from "@tanstack/react-query";
import { WATCHING_KEYS } from "./query-keys";
import { getAllWatchedMedia } from "../service";
import type { WatchingMedia, MediaType } from "../types";

interface UseLibraryOptions {
  userId: string;
  type?: MediaType;
  limit?: number;
  initialData?: WatchingMedia[];
}

export function useLibrary({ userId, type, limit, initialData }: UseLibraryOptions) {
  return useQuery({
    ...(initialData && { initialData }),
    queryKey: WATCHING_KEYS.library(userId),
    queryFn: () => getAllWatchedMedia(userId, { type, limit }),
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}
