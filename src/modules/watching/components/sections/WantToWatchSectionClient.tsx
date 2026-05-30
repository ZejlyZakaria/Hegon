"use client";

import { toast } from "@/shared/utils/toast";
import { MediaCarousel } from "@/modules/watching/components/shared/MediaCarousel";
import { CarouselSkeleton } from "@/modules/watching/components/WatchingSkeletons";
import { useWatching } from "@/modules/watching/components/WatchingClient";
import { useDeleteMedia } from "@/modules/watching/hooks/useDeleteMedia";
import { useMovies } from "@/modules/watching/hooks/useMovies";
import { useSeries } from "@/modules/watching/hooks/useSeries";
import { useAnimes } from "@/modules/watching/hooks/useAnimes";
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
    limit: 20,
  });

  const deleteMediaMutation = useDeleteMedia();
  const { openModal } = useWatching();

  if (isLoading) return <CarouselSkeleton />;

  const handleDelete = async (itemId: string) => {
    try {
      await deleteMediaMutation.mutateAsync(itemId);
      toast.success("Removed from watchlist.");
    } catch {
      toast.error("Error occurred while deleting.");
    }
  };

  return (
    <MediaCarousel
      title="Want to Watch"
      subtitle={`Your watchlist — up to 20 ${config.labelPlural}`}
      items={items}
      onAddClick={items.length < 20 ? () => openModal("wantToWatch") : undefined}
      onDelete={handleDelete}
    />
  );
}
