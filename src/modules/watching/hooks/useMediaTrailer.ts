/* eslint-disable @typescript-eslint/no-explicit-any */
import { useTitleBundle } from "./useTitleBundle";
import type { TitleBundle } from "../service";
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

const selectTrailer = (b: TitleBundle): Trailer | null => pickTrailer(b.videos);

export function useMediaTrailer(tmdbId: number, type: MediaType, enabled = true) {
  return useTitleBundle(tmdbId, type, enabled, selectTrailer);
}
