"use client";

import { toast } from "@/shared/utils/toast";
import { isDemoReadOnlyError } from "@/shared/utils/demo-guard";
import { MediaCarousel } from "@/modules/watching/components/shared/MediaCarousel";
import { CarouselSkeleton } from "@/modules/watching/components/shared/WatchingSkeletons";
import { useWatching } from "@/modules/watching/components/WatchingClient";
import { useDeleteMedia } from "@/modules/watching/hooks/useDeleteMedia";
import { useMovies } from "@/modules/watching/hooks/useMovies";
import { useSeries } from "@/modules/watching/hooks/useSeries";
import { useAnimes } from "@/modules/watching/hooks/useAnimes";
import { isAwaitingRelease } from "@/modules/watching/utils";
import type { WatchingConfig } from "@/modules/watching/types";

interface Props {
  userId: string;
  config: WatchingConfig;
}

export default function WantToWatchSectionClient({ userId, config }: Props) {
  const hookMap = { film: useMovies, serie: useSeries, anime: useAnimes };
  const { data: items = [], isLoading } = hookMap[config.type]({
    userId,
    wantToWatch: true,
    limit: 50,
  });

  const deleteMediaMutation = useDeleteMedia();
  const { openModal } = useWatching();

  if (isLoading) return <CarouselSkeleton />;

  // Unreleased films live in their own "Waiting for" rail — so a title is in exactly one place.
  // (Series/anime never match `isAwaitingRelease`, so this is a no-op for them.)
  // The rail keeps the order the query returned. Sorting by priority was tried and reverted: with
  // the coloured bookmark on every card, sorting only stacked every red mark at the head of the
  // rail, saying twice what the colour already says — and it silently changed what this rail means.
  const ready = items.filter((it) => !isAwaitingRelease(it));

  const handleDelete = async (itemId: string) => {
    try {
      await deleteMediaMutation.mutateAsync(itemId);
      toast.success("Removed from watchlist.");
    } catch (err) {
      if (isDemoReadOnlyError(err)) return;
      toast.error("Error occurred while deleting.");
    }
  };

  return (
    <MediaCarousel
      title="Want to Watch"
      subtitle={`Your watchlist — ${ready.length}`}
      items={ready}
      onAddClick={items.length < 50 ? () => openModal("wantToWatch") : undefined}
      onDelete={handleDelete}
    />
  );
}
