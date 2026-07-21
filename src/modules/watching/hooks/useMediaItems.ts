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
  if (options.watched) return WATCHING_KEYS.byStatus(type, "completed");
  if (type === "film") return WATCHING_KEYS.movies();
  if (type === "serie") return WATCHING_KEYS.series();
  return WATCHING_KEYS.animes();
}

export function useMediaItems({ userId, type, initialData, ...options }: UseMediaItemsOptions) {
  return useQuery({
    ...(initialData && { initialData }),
    queryKey: resolveQueryKey(type, options),
    queryFn: () => getMediaItems(userId, type, options),
    // STALE AND FORGOTTEN ARE NOT THE SAME WORD — and confusing them is what put a skeleton on a
    // page you had already loaded. `staleTime` says "go check again"; `gcTime` says "throw the
    // answer away". At 5 minutes they were nearly equal, so a browse section left alone for the
    // length of an episode came back EMPTY and had to hard-load, when the rows were fine and one
    // background refetch away from fresh.
    //
    // Keep the 2-minute freshness (a status change elsewhere must land quickly) and let the answer
    // survive half an hour. The user sees the list instantly and the refetch happens underneath.
    staleTime: 2 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}
