/* eslint-disable @typescript-eslint/no-explicit-any */
import { useTitleBundle } from "./useTitleBundle";
import type { TitleBundle } from "../service";
import type { MediaType } from "../types";

export interface Trailer {
  key: string;   // YouTube video id
  name: string;
}

// Pick the best YouTube trailer: official Trailer first, then any Trailer, then a Teaser, then any
// YouTube clip. Within a tier we sort by RESOLUTION first, then recency.
//
// TMDB's `size` is the video height (1080 / 720 / 480 / 360). Sorting by it fixes titles that were
// serving a low-res trailer: The Dark Knight had a 240p official trailer picked over an HD one just
// because it was published later. Modern trailers are all 1080, so among them `size` ties and
// recency still decides — a long-running show keeps surfacing its LATEST trailer.
function pickTrailer(videos: any): Trailer | null {
  const results: any[] = videos?.results ?? [];
  const yt = results.filter((v) => v.site === "YouTube" && v.key);
  if (yt.length === 0) return null;

  const byBest = (a: any, b: any) => {
    const bySize = (b.size ?? 0) - (a.size ?? 0);
    if (bySize !== 0) return bySize;
    return new Date(b.published_at ?? 0).getTime() - new Date(a.published_at ?? 0).getTime();
  };

  const officialTrailers = yt.filter((v) => v.type === "Trailer" && v.official).sort(byBest);
  const anyTrailers      = yt.filter((v) => v.type === "Trailer").sort(byBest);
  const teasers          = yt.filter((v) => v.type === "Teaser").sort(byBest);

  const best = officialTrailers[0] ?? anyTrailers[0] ?? teasers[0] ?? yt[0];
  return best ? { key: best.key, name: best.name } : null;
}

const selectTrailer = (b: TitleBundle): Trailer | null => pickTrailer(b.videos);

export function useMediaTrailer(tmdbId: number, type: MediaType, enabled = true) {
  return useTitleBundle(tmdbId, type, enabled, selectTrailer);
}
