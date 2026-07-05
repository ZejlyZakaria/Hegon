import { useQuery } from "@tanstack/react-query";
import { searchItunesArtwork } from "../service";

// Square single/album artwork for a theme (iTunes). Cached hard — art never changes.
export function useItunesArtwork(title: string, artist: string, enabled = true) {
  return useQuery({
    queryKey: ["itunes-art", title, artist],
    queryFn: () => searchItunesArtwork(title, artist),
    staleTime: 7 * 24 * 60 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    enabled: enabled && !!title,
  });
}
