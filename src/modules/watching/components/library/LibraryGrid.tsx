"use client";

import { useState } from "react";
import LibraryCard from "./LibraryCard";
import MediaDetailModal from "@/modules/watching/components/modals/MediaDetailModal";
import type { WatchingMedia } from "@/modules/watching/types";

export default function LibraryGrid({
  items,
  onUpdate,
  onDelete,
}: {
  items: WatchingMedia[];
  onUpdate?: (item: WatchingMedia) => void;
  onDelete?: (itemId: string) => void;
}) {
  const [selectedItem, setSelectedItem] = useState<WatchingMedia | null>(null);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <p className="text-sm text-text-tertiary">
          {items.length} media{items.length > 1 ? "s" : ""}
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
        {items.map((item) => (
          <LibraryCard
            key={item.id}
            item={item}
            onClick={() => setSelectedItem(item)}
          />
        ))}
      </div>

      {selectedItem && (
        <MediaDetailModal
          isOpen={!!selectedItem}
          onClose={() => setSelectedItem(null)}
          item={selectedItem}
          onUpdate={(item) => {
            onUpdate?.(item);
            setSelectedItem(null);
          }}
          onDelete={
            onDelete
              ? (id) => {
                  onDelete(id);
                  setSelectedItem(null);
                }
              : undefined
          }
        />
      )}

      {items.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-text-tertiary">No media found</p>
        </div>
      )}
    </div>
  );
}
