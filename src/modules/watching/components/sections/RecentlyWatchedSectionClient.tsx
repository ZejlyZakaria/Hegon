"use client";

import { toast } from "sonner";
import { MediaCarousel } from "@/modules/watching/components/shared/MediaCarousel";
import { useWatching } from "@/modules/watching/components/WatchingClient";
import { useUpdateMedia } from "@/modules/watching/hooks/useUpdateMedia";
import { useDeleteMedia } from "@/modules/watching/hooks/useDeleteMedia";
import { useMovies } from "@/modules/watching/hooks/useMovies";
import { useSeries } from "@/modules/watching/hooks/useSeries";
import { useAnimes } from "@/modules/watching/hooks/useAnimes";
import type { WatchingMedia, WatchingConfig } from "@/modules/watching/types";

interface Props {
  initialItems: WatchingMedia[];
  userId: string;
  config: WatchingConfig;
}

export default function RecentlyWatchedSectionClient({ initialItems, userId, config }: Props) {
  const hookMap = { film: useMovies, serie: useSeries, anime: useAnimes };
  const { data: items = [] } = hookMap[config.type]({
    userId,
    recentlyWatched: true,
    limit: 10,
    initialData: initialItems,
  });

  const updateMediaMutation = useUpdateMedia();
  const deleteMediaMutation = useDeleteMedia();
  const { openModal, notifyDeleted } = useWatching();

  const handleDelete = async (itemId: string) => {
    try {
      await deleteMediaMutation.mutateAsync(itemId);
      notifyDeleted(itemId);
      toast.success("Supprimé.");
    } catch {
      toast.error("Erreur lors de la suppression.");
    }
  };

  const handleUpdate = async (updated: WatchingMedia) => {
    try {
      await updateMediaMutation.mutateAsync({
        id: updated.id,
        user_rating: updated.user_rating,
        notes: updated.notes,
      });
    } catch {
      toast.error("Erreur lors de la mise à jour.");
    }
  };

  return (
    <MediaCarousel
      title="Recently Watched"
      subtitle={`Your 10 most recently watched ${config.labelPlural}`}
      items={items}
      onAddClick={() => openModal("recentlyWatched")}
      onDelete={handleDelete}
      onUpdate={handleUpdate}
    />
  );
}
