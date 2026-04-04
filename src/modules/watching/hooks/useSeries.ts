import { useMediaItems } from "./useMediaItems";
import type { WatchingMedia } from "../types";

interface UseSeriesOptions {
  userId: string;
  inProgress?: boolean;
  recentlyWatched?: boolean;
  wantToWatch?: boolean;
  topRated?: boolean;
  limit?: number;
  initialData?: WatchingMedia[];
}

export function useSeries(options: UseSeriesOptions) {
  return useMediaItems({ ...options, type: "serie" });
}
