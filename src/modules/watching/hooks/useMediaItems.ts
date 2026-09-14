import { useQuery } from "@tanstack/react-query";
import { WATCHING_KEYS } from "./query-keys";
import { countMediaItems, getMediaItems } from "../service";
import type { GetMediaOptions } from "../service";
import type { WatchingMedia, MediaType } from "../types";
import { STALE } from "@/shared/lib/stale";

interface UseMediaItemsOptions extends GetMediaOptions {
  userId: string;
  type: MediaType;
  initialData?: WatchingMedia[];
  /** Off = the query does not run (a panel's list before the panel is opened). */
  enabled?: boolean;
}

function resolveQueryKey(type: MediaType, options: GetMediaOptions) {
  if (options.inProgress) return WATCHING_KEYS.inProgress(type);
  if (options.recentlyWatched) return WATCHING_KEYS.recentlyWatched(type);
  if (options.wantToWatch && options.awaiting) return WATCHING_KEYS.waitingFor();
  if (options.wantToWatch && !options.limit) return WATCHING_KEYS.watchlistAll(type);
  if (options.wantToWatch) return WATCHING_KEYS.wantToWatch(type);
  if (options.topRated) return WATCHING_KEYS.topRated(type);
  if (options.watched) return WATCHING_KEYS.byStatus(type, "completed");
  if (type === "film") return WATCHING_KEYS.movies();
  if (type === "serie") return WATCHING_KEYS.series();
  return WATCHING_KEYS.animes();
}

export function useMediaItems({ userId, type, initialData, enabled = true, ...options }: UseMediaItemsOptions) {
  return useQuery({
    ...(initialData && { initialData }),
    enabled,
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

/**
 * The size of a section behind a capped rail — asked only when the rail is FULL (fewer rows than
 * the cap means the rail already is the whole answer). One HEAD request, no rows.
 */
export function useMediaCount({ userId, type, enabled = true, ...options }: UseMediaItemsOptions) {
  return useQuery({
    queryKey: WATCHING_KEYS.wantToWatchCount(type),
    queryFn: () => countMediaItems(userId, type, options),
    staleTime: STALE.TWO_MINUTES,
    gcTime: STALE.HALF_HOUR,
    enabled,
  });
}
