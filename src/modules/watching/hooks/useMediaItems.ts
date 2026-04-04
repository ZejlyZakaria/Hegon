import { useQuery } from "@tanstack/react-query";
import { WATCHING_KEYS } from "./query-keys";
import { getMediaItems } from "../service";
import type { GetMediaOptions } from "../service";
import type { WatchingMedia, MediaType } from "../types";

interface UseMediaItemsOptions extends GetMediaOptions {
  userId: string;
  type: MediaType;
  initialData?: WatchingMedia[];
}

function resolveQueryKey(type: MediaType, options: GetMediaOptions) {
  if (options.inProgress) return WATCHING_KEYS.inProgress(type);
  if (options.recentlyWatched) return WATCHING_KEYS.recentlyWatched(type);
  if (options.wantToWatch) return WATCHING_KEYS.wantToWatch(type);
  if (options.topRated) return WATCHING_KEYS.topRated(type);
  if (type === "film") return WATCHING_KEYS.movies();
  if (type === "serie") return WATCHING_KEYS.series();
  return WATCHING_KEYS.animes();
}

export function useMediaItems({ userId, type, initialData, ...options }: UseMediaItemsOptions) {
  return useQuery({
    ...(initialData && { initialData }),
    queryKey: resolveQueryKey(type, options),
    queryFn: () => getMediaItems(userId, type, options),
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}
