"use client";

import { useState } from "react";
import { toast } from "@/shared/utils/toast";
import { isDemoReadOnlyError } from "@/shared/utils/demo-guard";
import { MediaCarousel } from "@/modules/watching/components/shared/MediaCarousel";
import { CarouselSkeleton } from "@/modules/watching/components/shared/WatchingSkeletons";
import { useWatching } from "@/modules/watching/components/WatchingClient";
import { useDeleteMedia } from "@/modules/watching/hooks/useDeleteMedia";
import { useMovies } from "@/modules/watching/hooks/useMovies";
import { useSeries } from "@/modules/watching/hooks/useSeries";
import { useAnimes } from "@/modules/watching/hooks/useAnimes";
import { useMediaCount } from "@/modules/watching/hooks/useMediaItems";
import { WatchlistPanel } from "./WatchlistPanel";
import type { WatchingConfig } from "@/modules/watching/types";

/**
 * A carousel of 74 is not a list you browse, it is a list you scroll past. The rail shows the
 * newest RAIL_LIMIT; "See all" opens the whole watchlist in a panel with its own query, sort and
 * filters. The subtitle counts the whole list, not the window — a count query is asked only when
 * the rail is full, since a rail that isn't IS the whole list.
 */
const RAIL_LIMIT = 20;

interface Props {
  userId: string;
  config: WatchingConfig;
}

export default function WantToWatchSectionClient({ userId, config }: Props) {
  const hookMap = { film: useMovies, serie: useSeries, anime: useAnimes };
  // Unreleased films live in their own "Waiting for" rail (`awaiting`), so a title is in exactly
  // one place — the split is in the query now, not in a client-side filter over a shared fetch.
  // The rail keeps the order the query returned. Sorting by priority was tried and reverted: with
  // the coloured bookmark on every card, sorting only stacked every red mark at the head of the
  // rail, saying twice what the colour already says — and it silently changed what this rail means.
  const { data: ready = [], isLoading } = hookMap[config.type]({
    userId,
    wantToWatch: true,
    released: true,
    limit: RAIL_LIMIT,
  });
  const full = ready.length >= RAIL_LIMIT;
  const { data: total } = useMediaCount({ userId, type: config.type, wantToWatch: true, released: true, enabled: full });
  const [allOpen, setAllOpen] = useState(false);

  const deleteMediaMutation = useDeleteMedia();
  const { openModal } = useWatching();

  if (isLoading) return <CarouselSkeleton />;

  const handleDelete = async (itemId: string) => {
    try {
      await deleteMediaMutation.mutateAsync(itemId);
      toast.success("Removed from watchlist.");
    } catch (err) {
      if (isDemoReadOnlyError(err)) return;
      toast.error("Error occurred while deleting.");
    }
  };

  const count = full ? (total ?? ready.length) : ready.length;

  return (
    <>
      <MediaCarousel
        title="Want to Watch"
        subtitle={`Your watchlist — ${count}`}
        items={ready}
        onAddClick={() => openModal("wantToWatch")}
        onSeeAll={full ? () => setAllOpen(true) : undefined}
        onDelete={handleDelete}
      />
      <WatchlistPanel open={allOpen} onClose={() => setAllOpen(false)} userId={userId} type={config.type} />
    </>
  );
}
