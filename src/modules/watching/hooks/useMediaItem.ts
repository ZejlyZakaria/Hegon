import { useQuery } from "@tanstack/react-query";
import { WATCHING_KEYS } from "./query-keys";
import { getMediaItemById } from "../service";

/**
 * Your row, in full — the only query the detail page is built on.
 *
 * ⛔ NO `placeholderData` SEEDED FROM THE CAROUSELS, AND THAT IS A DECISION, NOT AN OMISSION.
 * Seeding the fiche from a cached section row is the obvious "make it instant" move and it is a
 * trap: `SECTION_COLUMNS` is a SUBSET. It carries no description, no notes, no cast, no
 * `cour_years`. The page would paint a real title with an empty synopsis, no rating, and — on a
 * lumped anime — the WRONG YEARS, then correct itself a moment later.
 *
 * That is the fault the owner named: a screen that changes its mind is worse than a screen that
 * waits. A seed is only honest when it is a PREFIX of the truth, and this one is a different shape.
 * The instant-open win belongs to prefetching on intent, or to a seed the page knows is partial —
 * not to handing incomplete columns to a component that reads them as complete.
 */
export function useMediaItem(id: string) {
  return useQuery({
    queryKey: WATCHING_KEYS.detail(id),
    queryFn: () => getMediaItemById(id),
    enabled: !!id,
    // Same reasoning as the sections: a fiche you opened ten minutes ago should reopen instantly
    // and refresh underneath, not skeleton because the cache forgot it. (Freshness is unchanged —
    // every mutation invalidates this key by id, so an edit still lands immediately.)
    staleTime: 2 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}
