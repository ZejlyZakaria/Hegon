"use client";

import { useMemo } from "react";
import { toast } from "@/shared/utils/toast";
import { isDemoReadOnlyError } from "@/shared/utils/demo-guard";
import { MediaCarousel } from "@/modules/watching/components/shared/MediaCarousel";
import { CarouselSkeleton } from "@/modules/watching/components/shared/WatchingSkeletons";
import { useWatching } from "@/modules/watching/components/WatchingClient";
import { useDeleteMedia } from "@/modules/watching/hooks/useDeleteMedia";
import { useMovies } from "@/modules/watching/hooks/useMovies";
import { useSeries } from "@/modules/watching/hooks/useSeries";
import { useAnimes } from "@/modules/watching/hooks/useAnimes";
import { isAwaitingNextSeason } from "@/modules/watching/lib/series-state";
import type { WatchingConfig, WatchingMedia } from "@/modules/watching/types";

interface Props {
  userId: string;
  config: WatchingConfig;
}

// When you last engaged with a title: a finished one by its watch date, a caught-up one by when you
// last moved forward. `updated_at` is the last-resort floor (always present).
const lastWatched = (m: WatchingMedia) =>
  new Date(m.watched_at ?? m.last_watched_at ?? m.updated_at).getTime();

export default function RecentlyWatchedSectionClient({ userId, config }: Props) {
  const hookMap = { film: useMovies, serie: useSeries, anime: useAnimes };
  const { data: watched = [], isLoading } = hookMap[config.type]({
    userId,
    recentlyWatched: true,
    limit: 10,
  });
  // "Up to date" = finished OR awaiting a next season. The latter are in_progress (not watched — the
  // show isn't over), so they arrive through this second, already-cached query and join the finished
  // ones, newest activity first. In Progress excludes exactly these, so a title lands in one rail.
  const { data: following = [] } = hookMap[config.type]({
    userId,
    inProgress: true,
    limit: 10,
  });
  const items = useMemo(
    () =>
      [...watched, ...following.filter(isAwaitingNextSeason)]
        .sort((a, b) => lastWatched(b) - lastWatched(a))
        .slice(0, 10),
    [watched, following],
  );

  const deleteMediaMutation = useDeleteMedia();
  const { openModal } = useWatching();

  if (isLoading) return <CarouselSkeleton />;

  const handleDelete = async (itemId: string) => {
    try {
      await deleteMediaMutation.mutateAsync(itemId);
      toast.success("Deleted.");
    } catch (err) {
      if (isDemoReadOnlyError(err)) return;
      toast.error("Error occurred while deleting.");
    }
  };

  return (
    <MediaCarousel
      title="Last Watched"
      subtitle={`The last 10 ${config.labelPlural} you watched`}
      items={items}
      onAddClick={() => openModal("recentlyWatched")}
      onDelete={handleDelete}
      showWatchedAgo
      showCaughtUp
    />
  );
}
