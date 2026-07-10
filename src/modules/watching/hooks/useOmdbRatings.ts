/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQuery } from "@tanstack/react-query";
import { TMDB_KEYS } from "./query-keys";
import { getOmdbData } from "../service";

export interface OmdbInfo {
  imdb: string | null;            // "7.6"
  imdbVotes: string | null;       // "828,114"
  rottenTomatoes: string | null;  // "85%"
  metacritic: string | null;      // "67" (out of 100)
  awards: string | null;
  boxOffice: string | null;
  // Already in the same response — free reference facts for the Details card.
  country: string | null;         // "South Korea"
  language: string | null;        // "Korean"
  released: string | null;        // "30 May 2019" (films)
  yearRange: string | null;       // "2013–2023" (series run)
}

const clean = (v: any): string | null => (v && v !== "N/A" ? String(v) : null);

function mapOmdb(data: any): OmdbInfo | null {
  if (!data || data.Response === "False") return null;
  const ratings: any[] = data.Ratings ?? [];
  const rt = ratings.find((r) => r.Source === "Rotten Tomatoes")?.Value ?? null;
  return {
    imdb: clean(data.imdbRating),
    imdbVotes: clean(data.imdbVotes),
    rottenTomatoes: clean(rt),
    metacritic: clean(data.Metascore),
    awards: clean(data.Awards),
    boxOffice: clean(data.BoxOffice),
    country: clean(data.Country),
    language: clean(data.Language),
    released: clean(data.Released),
    yearRange: clean(data.Year),
  };
}

export function useOmdbRatings(imdbId: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: TMDB_KEYS.omdb(imdbId ?? ""),
    queryFn: async () => mapOmdb(await getOmdbData(imdbId!)),
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    enabled: enabled && !!imdbId,
  });
}
