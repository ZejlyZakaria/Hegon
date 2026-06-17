"use client";

import { toast } from "@/shared/utils/toast";
import { MediaCarousel } from "@/modules/watching/components/shared/MediaCarousel";
import { CarouselSkeleton } from "@/modules/watching/components/shared/WatchingSkeletons";
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

export default function TopTenSectionClient({ userId, config }: Props) {
  const hookMap = { film: useMovies, serie: useSeries, anime: useAnimes };
  const { data: items = [], isLoading } = hookMap[config.type]({
    userId,
    topRated: true,
  });

  const deleteMediaMutation = useDeleteMedia();
  const { openModal } = useWatching();

  if (isLoading) return <CarouselSkeleton />;

  const handleDelete = async (itemId: string) => {
    try {
      await deleteMediaMutation.mutateAsync(itemId);
      toast.success("Deleted from Top 10.");
    } catch {
      toast.error("Error occurred while deleting the item.");
    }
  };

  const label =
    config.labelPlural === "films"
      ? "of all time"
      : config.labelPlural === "series"
        ? "Series"
        : "Animes";

  return (
    <MediaCarousel
      title={`My Top 10 ${label}`}
      subtitle={`Your highest-rated ${config.labelPlural} — ${items.length}/10`}
      items={items}
      onAddClick={items.length < 10 ? () => openModal("topTen") : undefined}
      onDelete={handleDelete}
      showRankBadge={true}
    />
  );
}
