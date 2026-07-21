/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback } from "react";
import { useTitleBundle } from "./useTitleBundle";
import type { TitleBundle } from "../service";
import type { MediaType } from "../types";

export function useSimilarTitles(tmdbId: number, type: MediaType, enabled = true) {
  const select = useCallback(
    (b: TitleBundle): any[] => {
      let results: any[] = b.recommendations?.results ?? [];
      // TMDB has no "anime" of its own — it's animation (genre 16) plus origin. A show's
      // recommendations are full of live-action neighbours, which is not what this rail promises.
      if (type === "anime") results = results.filter((r) => r.genre_ids?.includes(16));
      // Over-fetch: the detail page filters out already-owned titles, then slices to 6 — so we
      // keep enough headroom to still show 6 addable recommendations.
      return results.slice(0, 20);
    },
    [type],
  );
  return useTitleBundle(tmdbId, type, enabled, select);
}
