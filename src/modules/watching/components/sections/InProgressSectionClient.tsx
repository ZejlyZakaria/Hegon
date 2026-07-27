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
import type { WatchingConfig } from "@/modules/watching/types";

interface Props {
  userId: string;
  config: WatchingConfig;
}

export default function InProgressSectionClient({ userId, config }: Props) {
  const hookMap = { film: useMovies, serie: useSeries, anime: useAnimes };
  const { data: raw = [], isLoading } = hookMap[config.type]({
    userId,
    inProgress: true,
    limit: 10,
  });
  // Only titles AWAITING A NEXT SEASON leave (caught up + the season has finished airing) — those go
  // to Last Watched. A show still releasing weekly stays here: it's caught up for a few days, but an
  // episode is imminent and you're actively following it. Derived, so it re-buckets on its own.
  const items = useMemo(() => raw.filter((i) => !isAwaitingNextSeason(i)), [raw]);

  const deleteMediaMutation = useDeleteMedia();
  const { openModal } = useWatching();

  if (isLoading) return <CarouselSkeleton />;

  const handleDelete = async (itemId: string) => {
    try {
      await deleteMediaMutation.mutateAsync(itemId);
      toast.success("Deleted.");
    } catch (err) {
      if (isDemoReadOnlyError(err)) return;
      toast.error("Error occurred while deleting the item.");
    }
  };

  const label = config.labelPlural === "series" ? "Series" : "Animes";

  return (
    <MediaCarousel
      title="In Progress"
      subtitle={`${label} that you are currently watching`}
      items={items}
      onAddClick={() => openModal("inProgress")}
      onDelete={handleDelete}
      showEpisodeBadge={true}
    />
  );
}
