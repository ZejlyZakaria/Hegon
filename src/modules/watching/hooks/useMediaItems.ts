import { useQuery } from "@tanstack/react-query";
import { WATCHING_KEYS } from "./query-keys";
import { getMediaItems } from "../service";
import type { GetMediaOptions } from "../service";
import type { WatchingMedia, MediaType } from "../types";
import { STALE } from "@/shared/lib/stale";

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
    staleTime: STALE.TWO_MINUTES,
    gcTime: STALE.HALF_HOUR,
    // MULTI-DEVICE — the per-module arbitrage doctrine R4 leaves to phase 3, and for Watching the
    // answer is yes for STATUSES: a film marked watched on the phone must show on the PC tab you
    // come back to. Global default is off; a stale, mounted section refetches when the tab regains
    // focus (only the mounted observers — the sections on screen — not every cached query).
    refetchOnWindowFocus: true,
  });
}
