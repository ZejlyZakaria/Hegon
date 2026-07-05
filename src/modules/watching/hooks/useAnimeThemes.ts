import { useQuery } from "@tanstack/react-query";
import { searchAnimeThemes } from "../service";

// OP/ED themes for an anime (AnimeThemes.moe). Anime-only; searched by title.
export function useAnimeThemes(title: string, isAnime: boolean, enabled = true) {
  return useQuery({
    queryKey: ["animethemes", title],
    queryFn: () => searchAnimeThemes(title),
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    enabled: enabled && isAnime && !!title,
  });
}
