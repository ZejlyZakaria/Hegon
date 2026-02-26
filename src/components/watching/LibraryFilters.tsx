"use client";

import { useState } from "react";
import { ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import NormalSelect from "@/ui/inputs/insideLabel/normalSelect";

type SortKey = "added" | "rating" | "title" | "year" | "favorite";

type LibraryFiltersProps = {
  onFilterChange: (filters: {
    mediaType: "all" | "film" | "serie" | "anime";
    sortBy: SortKey;
  }) => void;
};

export default function LibraryFilters({ onFilterChange }: LibraryFiltersProps) {
  const [mediaType, setMediaType] = useState<"all" | "film" | "serie" | "anime">("all");
  const [sortBy, setSortBy] = useState<SortKey>("added");

  const handleMediaChange = (newType: typeof mediaType) => {
    setMediaType(newType);
    onFilterChange({ mediaType: newType, sortBy });
  };

  const handleSortChange = (newSort: string) => {
    const typedSort = newSort as SortKey;
    setSortBy(typedSort);
    onFilterChange({ mediaType, sortBy: typedSort });
  };

  return (
    <div className="flex flex-wrap items-center gap-4 mb-4">
      
      {/* Media Type Chips */}
      <div className="flex gap-2">
        {(["all", "film", "serie", "anime"] as const).map((type) => (
          <button
            key={type}
            onClick={() => handleMediaChange(type)}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-medium transition",
              mediaType === type
                ? "bg-white text-black"
                : "bg-white/10 text-zinc-400 hover:bg-white/20"
            )}
          >
            {type === "all"
              ? "Tout"
              : type === "film"
              ? "Films"
              : type === "serie"
              ? "Séries"
              : "Animes"}
          </button>
        ))}
      </div>

      {/* Sort */}
      <div className="flex items-center gap-3 ml-auto">
        <ArrowUpDown size={16} className="text-zinc-500" />
        <span className="text-sm text-zinc-500">Trier par :</span>

        <NormalSelect
          id="sort-select"
          value={sortBy}
          onChange={handleSortChange}
          className="w-34"
          options={[
            { label: "Date d'ajout", value: "added" },
            { label: "Note", value: "rating" },
            { label: "Titre", value: "title" },
            { label: "Année", value: "year" },
            { label: "Favoris", value: "favorite" },
          ]}
        />
      </div>
    </div>
  );
}
