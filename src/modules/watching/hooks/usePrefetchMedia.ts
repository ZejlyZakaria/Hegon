"use client";

import { useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { WATCHING_KEYS } from "./query-keys";
import { getMediaItemById } from "../service";

/**
 * FETCH THE FICHE WHILE THE POINTER IS STILL ON ITS WAY.
 *
 * Opening a title cannot start its query until the detail page mounts — the row, the rewatches, the
 * lists. That is a fixed wait after every click, and the SSR migration that would have removed it
 * was measured and rejected (a ~440ms first-visit gain against a permanent fork of the read layer;
 * see hq/now.md). This buys most of the same thing for none of the risk.
 *
 * Hovering a card is a statement of intent, and there are ~200-400ms between that hover and the
 * click. We spend them on the request instead of waiting for the click to start it.
 *
 * Deliberately cheap and quiet:
 *   · `prefetchQuery` writes into the SAME key the page will read, so the page finds a warm cache
 *     rather than issuing a second request. It also NO-OPS when fresh data is already there.
 *   · one per id per mount (`seen`) — a rail you sweep the mouse across must not fire thirty
 *     requests, which would be slower than doing nothing at all.
 *   · never on touch. There is no hover on a phone; the "intent" signal doesn't exist, and firing on
 *     touchstart would prefetch things you are only scrolling past.
 */
export function usePrefetchMedia() {
  const queryClient = useQueryClient();
  const seen = useRef<Set<string>>(new Set());

  return useCallback(
    (id: string) => {
      if (!id || seen.current.has(id)) return;
      seen.current.add(id);
      void queryClient.prefetchQuery({
        queryKey: WATCHING_KEYS.detail(id),
        queryFn: () => getMediaItemById(id),
        // Matches useMediaItem: a fiche opened minutes ago is still good, and prefetch must never
        // be the thing that decides data is stale.
        staleTime: 2 * 60 * 1000,
      });
    },
    [queryClient],
  );
}
