"use client";

import { toast } from "sonner";
import { MediaCarousel } from "@/modules/watching/components/shared/MediaCarousel";
import { useWatching } from "@/modules/watching/components/WatchingClient";
import { useUpdateMedia } from "@/modules/watching/hooks/useUpdateMedia";
import { useDeleteMedia } from "@/modules/watching/hooks/useDeleteMedia";
import { useMarkAsWatched } from "@/modules/watching/hooks/useMarkAsWatched";
import { useMovies } from "@/modules/watching/hooks/useMovies";
import { useSeries } from "@/modules/watching/hooks/useSeries";
import { useAnimes } from "@/modules/watching/hooks/useAnimes";
import type { WatchingMedia, WatchingConfig } from "@/modules/watching/types";

interface Props {
  initialItems: WatchingMedia[];
  userId: string;
  config: WatchingConfig;
}

export default function WantToWatchSectionClient({ initialItems, userId, config }: Props) {
  const hookMap = { film: useMovies, serie: useSeries, anime: useAnimes };
  const { data: items = [] } = hookMap[config.type]({
    userId,
    wantToWatch: true,
    limit: 20,
    initialData: initialItems,
  });

  const updateMediaMutation = useUpdateMedia();
  const deleteMediaMutation = useDeleteMedia();
  const markAsWatchedMutation = useMarkAsWatched();
  const { openModal, notifyMoved } = useWatching();

  const handleMarkWatched = async (itemId: string) => {
    try {
      const updated = await markAsWatchedMutation.mutateAsync(itemId);
      notifyMoved("wantToWatch", updated);
      toast.success("Marqué comme vu !");
    } catch {
      toast.error("Erreur lors de la mise à jour.");
    }
  };

  const handleDelete = async (itemId: string) => {
    try {
      await deleteMediaMutation.mutateAsync(itemId);
      toast.success("Supprimé de la watchlist.");
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
        priority_level: updated.priority_level,
      });
    } catch {
      toast.error("Erreur lors de la mise à jour.");
    }
  };

  return (
    <MediaCarousel
      title="Want to Watch"
      subtitle={`Your watchlist — up to 20 ${config.labelPlural}`}
      items={items}
      onAddClick={items.length < 20 ? () => openModal("wantToWatch") : undefined}
      onMarkWatched={handleMarkWatched}
      onDelete={handleDelete}
      onUpdate={handleUpdate}
    />
  );
}
