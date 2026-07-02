/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQuery } from "@tanstack/react-query";
import { TMDB_KEYS } from "./query-keys";
import { getMediaVideos } from "../service";
import type { MediaType } from "../types";

export interface Trailer {
  key: string;   // YouTube video id
  name: string;
}

// Pick the best YouTube trailer: official Trailer first, then any Trailer, then a
// Teaser, then any YouTube clip. Within a tier, the most recently published wins
// (so a long-running show surfaces its latest trailer).
function pickTrailer(videos: any): Trailer | null {
  const results: any[] = videos?.results ?? [];
  const yt = results.filter((v) => v.site === "YouTube" && v.key);
  if (yt.length === 0) return null;

  const byRecent = (a: any, b: any) =>
    new Date(b.published_at ?? 0).getTime() - new Date(a.published_at ?? 0).getTime();

  const officialTrailers = yt.filter((v) => v.type === "Trailer" && v.official).sort(byRecent);
  const anyTrailers      = yt.filter((v) => v.type === "Trailer").sort(byRecent);
  const teasers          = yt.filter((v) => v.type === "Teaser").sort(byRecent);

  const best = officialTrailers[0] ?? anyTrailers[0] ?? teasers[0] ?? yt[0];
  return best ? { key: best.key, name: best.name } : null;
}

export function useMediaTrailer(tmdbId: number, type: MediaType, enabled = true) {
  return useQuery({
    queryKey: TMDB_KEYS.trailer(type, tmdbId),
    queryFn: async () => {
      const tmdbType = type === "film" ? "movie" : "tv";
      const videos = await getMediaVideos(tmdbId, tmdbType);
      return pickTrailer(videos);
    },
    staleTime: 24 * 60 * 60 * 1000, // trailers rarely change
    gcTime: 60 * 60 * 1000,
    enabled: enabled && !!tmdbId,
  });
}
