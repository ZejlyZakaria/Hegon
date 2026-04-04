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

export default function InProgressSectionClient({ initialItems, userId, config }: Props) {
  const hookMap = { film: useMovies, serie: useSeries, anime: useAnimes };
  const { data: items = [] } = hookMap[config.type]({
    userId,
    inProgress: true,
    limit: 10,
    initialData: initialItems,
  });

  const updateMediaMutation = useUpdateMedia();
  const deleteMediaMutation = useDeleteMedia();
  const markAsWatchedMutation = useMarkAsWatched();
  const { openModal, notifyMoved, notifyDeleted } = useWatching();

  const handleMarkWatched = async (itemId: string) => {
    try {
      const updated = await markAsWatchedMutation.mutateAsync(itemId);
      notifyMoved("inProgress", updated);
      toast.success("Marked as finished!");
    } catch {
      toast.error("Error occurred while updating the item.");
    }
  };

  const handleRemoveFromProgress = async (itemId: string) => {
    try {
      await deleteMediaMutation.mutateAsync(itemId);
      notifyDeleted(itemId);
      toast.success("Deleted.");
    } catch {
      toast.error("Error occurred while deleting the item.");
    }
  };

  const handleUpdate = async (updated: WatchingMedia) => {
    try {
      await updateMediaMutation.mutateAsync({
        id: updated.id,
        user_rating: updated.user_rating,
        notes: updated.notes,
        current_episode: updated.current_episode,
        current_season: updated.current_season,
      });
    } catch {
      toast.error("Error occurred while updating the item.");
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
      onUpdate={handleUpdate}
      showEpisodeBadge={true}
    />
  );
}
