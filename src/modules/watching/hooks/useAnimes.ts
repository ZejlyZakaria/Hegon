import { useMediaItems } from "./useMediaItems";
import type { WatchingMedia } from "../types";

interface UseAnimesOptions {
  userId: string;
  inProgress?: boolean;
  recentlyWatched?: boolean;
  wantToWatch?: boolean;
  released?: boolean;
  awaiting?: boolean;
  topRated?: boolean;
  limit?: number;
  initialData?: WatchingMedia[];
}

export function useAnimes(options: UseAnimesOptions) {
  return useMediaItems({ ...options, type: "anime" });
}
