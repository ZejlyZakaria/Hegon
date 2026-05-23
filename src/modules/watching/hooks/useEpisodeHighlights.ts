import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/shared/utils/toast";
import {
  addEpisodeHighlight,
  getEpisodeHighlights,
  getTmdbEpisode,
  removeEpisodeHighlight,
} from "../service";

const KEYS = {
  byMedia: (mediaItemId: string) => ["watching", "episode-highlights", mediaItemId] as const,
};

export function useEpisodeHighlights(mediaItemId: string) {
  return useQuery({
    queryKey: KEYS.byMedia(mediaItemId),
    queryFn: () => getEpisodeHighlights(mediaItemId),
    enabled: !!mediaItemId,
  });
}

export function useAddEpisodeHighlight(mediaItemId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      tmdbId,
      userId,
      orgId,
      season,
      episode,
    }: {
      tmdbId: number;
      userId: string;
      orgId: string;
      season: number;
      episode: number;
    }) => {
      let ep: { name: string; still_path: string | null };
      try {
        ep = await getTmdbEpisode(tmdbId, season, episode);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "";
        if (msg.includes("404")) {
          throw new Error("Episode not found on TMDB. Check the season and episode numbers.");
        }
        throw new Error("TMDB unavailable. Try again.");
      }
      return addEpisodeHighlight({
        media_item_id: mediaItemId,
        user_id: userId,
        org_id: orgId,
        season,
        episode,
        title: ep.name ?? null,
        still_path: ep.still_path ?? null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEYS.byMedia(mediaItemId) });
    },
  });
}

export function useRemoveEpisodeHighlight(mediaItemId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: removeEpisodeHighlight,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEYS.byMedia(mediaItemId) });
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: KEYS.byMedia(mediaItemId) });
      toast.error("Failed to remove episode.");
    },
  });
}
