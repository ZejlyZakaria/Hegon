// components/watching/LibraryFilters.tsx
"use client";

import { useState } from "react";
import { ArrowUpDown } from "lucide-react";
import { cn } from "@/shared/utils/utils"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";

// ─── types ────────────────────────────────────────────────────────────────────

type MediaType = "all" | "film" | "serie" | "anime";
type SortKey   = "added" | "rating" | "title" | "year" | "favorite";

interface Props {
  onFilterChange: (filters: { mediaType: MediaType; sortBy: SortKey }) => void;
}

// ─── config ───────────────────────────────────────────────────────────────────

const MEDIA_TYPES: { value: MediaType; label: string }[] = [
  { value: "all",   label: "All" },
  { value: "film",  label: "Films" },
  { value: "serie", label: "Series" },
  { value: "anime", label: "Animes" },
];

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "added",    label: "Date added" },
  { value: "rating",   label: "Rating" },
  { value: "title",    label: "Title" },
  { value: "year",     label: "Year" },
  { value: "favorite", label: "Favorite" },
];

// ─── main ─────────────────────────────────────────────────────────────────────

export default function LibraryFilters({ onFilterChange }: Props) {
  const [mediaType, setMediaType] = useState<MediaType>("all");
  const [sortBy, setSortBy]       = useState<SortKey>("added");

  const handleMediaChange = (value: MediaType) => {
    setMediaType(value);
    onFilterChange({ mediaType: value, sortBy });
  };

  const handleSortChange = (value: SortKey) => {
    setSortBy(value);
    onFilterChange({ mediaType, sortBy: value });
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* media type chips */}
      <div className="flex gap-2">
        {MEDIA_TYPES.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => handleMediaChange(value)}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-150",
              mediaType === value
                ? "bg-white text-black"
                : "bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* sort select — shadcn */}
      <div className="flex items-center gap-2 ml-auto">
        <ArrowUpDown size={14} className="text-zinc-500 shrink-0" />
        <Select value={sortBy} onValueChange={v => handleSortChange(v as SortKey)}>
          <SelectTrigger
            className="w-40 h-9 bg-zinc-900 border-zinc-800 text-zinc-300 text-sm hover:border-zinc-600 focus:ring-0 focus:ring-offset-0 transition-colors"
          >
            <SelectValue placeholder="Trier par..." />
          </SelectTrigger>
          <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-300">
            {SORT_OPTIONS.map(({ value, label }) => (
              <SelectItem
                key={value}
                value={value}
                className="text-sm focus:bg-zinc-800 focus:text-white cursor-pointer"
              >
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}