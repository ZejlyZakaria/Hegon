"use client";

import { useRouter } from "next/navigation";
import LibraryCard from "./LibraryCard";
import type { WatchingMedia } from "@/modules/watching/types";

export default function LibraryGrid({
  items,
  onDelete,
}: {
  items: WatchingMedia[];
  onDelete?: (itemId: string) => void;
}) {
  const router = useRouter();

  return (
    <div>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-3">
        {items.map((item, i) => (
          <LibraryCard
            key={item.id}
            item={item}
            onClick={() => router.push(`/perso/watching/${item.id}`)}
            onDelete={onDelete ? () => onDelete(item.id) : undefined}
            eagerLoad={i < 10}
          />
        ))}
      </div>

      {items.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-text-tertiary">No media found</p>
        </div>
      )}
    </div>
  );
}
