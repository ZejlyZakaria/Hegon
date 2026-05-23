"use client";

import { toast } from "@/shared/utils/toast";
import { MediaCarousel } from "@/modules/watching/components/shared/MediaCarousel";
import { CarouselSkeleton } from "@/modules/watching/components/WatchingSkeletons";
import { useWatching } from "@/modules/watching/components/WatchingClient";
import { useDeleteMedia } from "@/modules/watching/hooks/useDeleteMedia";
import { useMarkAsWatched } from "@/modules/watching/hooks/useMarkAsWatched";
import { useMovies } from "@/modules/watching/hooks/useMovies";
import { useSeries } from "@/modules/watching/hooks/useSeries";
import { useAnimes } from "@/modules/watching/hooks/useAnimes";
import type { WatchingConfig } from "@/modules/watching/types";

interface Props {
  userId: string;
  config: WatchingConfig;
}

export default function InProgressSectionClient({ userId, config }: Props) {
  const hookMap = { film: useMovies, serie: useSeries, anime: useAnimes };
  const { data: items = [], isLoading } = hookMap[config.type]({
    userId,
    inProgress: true,
    limit: 10,
  });

  const deleteMediaMutation = useDeleteMedia();
  const markAsWatchedMutation = useMarkAsWatched();
  const { openModal } = useWatching();

  if (isLoading) return <CarouselSkeleton />;

  const handleMarkWatched = async (itemId: string) => {
    try {
      await markAsWatchedMutation.mutateAsync(itemId);
      toast.success("Marked as finished!");
    } catch {
      toast.error("Error occurred while updating the item.");
    }
  };

  const handleRemoveFromProgress = async (itemId: string) => {
    try {
      await deleteMediaMutation.mutateAsync(itemId);
      toast.success("Deleted.");
    } catch {
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
      onMarkWatched={handleMarkWatched}
      onDelete={handleRemoveFromProgress}
      showEpisodeBadge={true}
    />
  );
}
