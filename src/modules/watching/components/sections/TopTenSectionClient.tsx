"use client";

import { useState, useCallback, useEffect } from "react";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { MediaCarousel } from "@/modules/watching/components/shared/MediaCarousel";
import { useWatching } from "@/modules/watching/components/WatchingClient";
import { useUpdateMedia } from "@/modules/watching/hooks/useUpdateMedia";
import { useDeleteMedia } from "@/modules/watching/hooks/useDeleteMedia";
import { useUpdatePriorities } from "@/modules/watching/hooks/useUpdatePriorities";
import { useMovies } from "@/modules/watching/hooks/useMovies";
import { useSeries } from "@/modules/watching/hooks/useSeries";
import { useAnimes } from "@/modules/watching/hooks/useAnimes";
import type { WatchingMedia, WatchingConfig } from "@/modules/watching/types";

interface Props {
  initialItems: WatchingMedia[];
  userId: string;
  config: WatchingConfig;
}

export default function TopTenSectionClient({ initialItems, userId, config }: Props) {
  const hookMap = { film: useMovies, serie: useSeries, anime: useAnimes };
  const { data: items = [] } = hookMap[config.type]({
    userId,
    topRated: true,
    initialData: initialItems,
  });

  const [localItems, setLocalItems] = useState(items);
  const [isDirty, setIsDirty] = useState(false);

  const updateMediaMutation = useUpdateMedia();
  const deleteMediaMutation = useDeleteMedia();
  const updatePrioritiesMutation = useUpdatePriorities();
  const { openModal, notifyDeleted } = useWatching();

  useEffect(() => {
    if (!isDirty) setLocalItems(items);
  }, [items, isDirty]);

  const handleReorder = useCallback((reordered: WatchingMedia[]) => {
    setLocalItems(reordered.map((item, i) => ({ ...item, priority: i + 1 })));
    setIsDirty(true);
  }, []);

  const handleSave = async () => {
    try {
      await updatePrioritiesMutation.mutateAsync({
        items: localItems.map((item) => ({ id: item.id, priority: item.priority! })),
        userId,
      });
      setIsDirty(false);
      toast.success("Ranking saved!");
    } catch {
      toast.error("Error occurred while saving the ranking.");
    }
  };

  const handleDelete = async (itemId: string) => {
    try {
      await deleteMediaMutation.mutateAsync(itemId);
      notifyDeleted(itemId);
      toast.success("Deleted from Top 10.");
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
      });
    } catch {
      toast.error("Erreur lors de la mise à jour.");
    }
  };

  const label =
    config.labelPlural === "films"
      ? "of all time"
      : config.labelPlural === "series"
        ? "Series"
        : "Animes";

  return (
    <div>
      {isDirty && (
        <div className="flex justify-end mb-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={updatePrioritiesMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
          >
            <Save size={14} />
            {updatePrioritiesMutation.isPending ? "Sauvegarde..." : "Sauvegarder le classement"}
          </button>
        </div>
      )}
      <MediaCarousel
        title={`My Top 10 ${label}`}
        subtitle={`Your 10 ${config.labelPlural} incontournables`}
        items={localItems}
        onAddClick={localItems.length < 10 ? () => openModal("topTen") : undefined}
        draggable
        onReorder={handleReorder}
        onDelete={handleDelete}
        onUpdate={handleUpdate}
        showRankBadge={true}
      />
    </div>
  );
}
