"use client";

import LibraryCard from "./LibraryCard";
import type { WatchItem } from "@/lib/watching-data";
import { useState } from "react";
import MediaDetailModal from "@/components/watching/MediaDetailModal";

export default function LibraryGrid({ items }: { items: WatchItem[] }) {
  const [selectedItem, setSelectedItem] = useState<WatchItem | null>(null);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <p className="text-sm text-zinc-500">
          {items.length} média{items.length > 1 ? "s" : ""}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
        {items.map((item) => (
          <LibraryCard key={item.id} item={item} onClick={() => setSelectedItem(item)}/>
        ))}
      </div>

      {selectedItem && (
        <MediaDetailModal
          isOpen={!!selectedItem}
          onClose={() => setSelectedItem(null)}
          item={selectedItem}
        />
      )}

      {items.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-zinc-500">Aucun média trouvé</p>
        </div>
      )}
    </div>
  );
}