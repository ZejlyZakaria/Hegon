import { useMediaItems } from "./useMediaItems";
import type { WatchingMedia } from "../types";

interface UseMoviesOptions {
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

export function useMovies(options: UseMoviesOptions) {
  return useMediaItems({ ...options, type: "film" });
}
