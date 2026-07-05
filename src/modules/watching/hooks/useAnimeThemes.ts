import { useQuery } from "@tanstack/react-query";
import { searchAnimeThemes } from "../service";

// Official TV OP/ED for an anime (AnimeThemes.moe). Anime-only; searched by title,
// anchored on `year` to keep the right franchise's seasons (no OVA/movie/spin-off).
export function useAnimeThemes(title: string, year: number | null, isAnime: boolean, enabled = true) {
  return useQuery({
    queryKey: ["animethemes", title, year],
    queryFn: () => searchAnimeThemes(title, year),
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    enabled: enabled && isAnime && !!title,
  });
}
