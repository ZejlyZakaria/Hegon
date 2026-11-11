import { queryOptions, useQuery } from "@tanstack/react-query";
import { searchAnimeThemes } from "../service";
import { WATCHING_KEYS } from "./query-keys";
import { STALE } from "@/shared/lib/stale";

// Official TV OP/ED for an anime (AnimeThemes.moe). Anime-only; searched by title,
// anchored on `year` to keep the right franchise's seasons (no OVA/movie/spin-off).
export function animeThemesOptions(title: string, year: number | null) {
  return queryOptions({
    queryKey: WATCHING_KEYS.animeThemes(title, year),
    queryFn: () => searchAnimeThemes(title, year),
    retry: false,
    retryOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    staleTime: STALE.DAY,
    gcTime: STALE.DAY,
  });
}


export function useAnimeThemes(title: string, year: number | null, isAnime: boolean, enabled = true) {
  return useQuery({ ...animeThemesOptions(title,year), enabled: enabled && isAnime && !!title });
}
