import { useQuery } from "@tanstack/react-query";
import { resolveThemeCovers, searchAnimeThemes } from "../service";
import { STALE } from "@/shared/lib/stale";

// Official TV OP/ED for an anime (AnimeThemes.moe). Anime-only; searched by title,
// anchored on `year` to keep the right franchise's seasons (no OVA/movie/spin-off).
export function useAnimeThemes(title: string, year: number | null, isAnime: boolean, enabled = true) {
  return useQuery({
    queryKey: ["animethemes", title, year],
    queryFn: () => searchAnimeThemes(title, year),
    staleTime: STALE.DAY,
    gcTime: STALE.DAY,
    enabled: enabled && isAnime && !!title,
  });
}

/**
 * The art of the tracks, resolved AFTER the list is on screen — one query for the batch, so the
 * section no longer waits for the slowest iTunes lookup before it can show a single title.
 */
export function useThemeCovers(tracks: { title: string; artist: string }[]) {
  const keys = tracks.map((t) => `${t.title}|${t.artist}`);
  return useQuery({
    queryKey: ["itunes-covers", keys],
    queryFn: () => resolveThemeCovers(tracks),
    staleTime: STALE.DAY,
    gcTime: STALE.DAY,
    enabled: tracks.length > 0,
  });
}
