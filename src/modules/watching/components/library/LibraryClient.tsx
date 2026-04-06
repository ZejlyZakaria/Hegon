// components/watching/LibraryClient.tsx
"use client";

import { useState, useMemo, useCallback } from "react";
import { Search, X, Plus } from "lucide-react";
import LibraryFilters from "@/modules/watching/components/library/LibraryFilters";
import LibraryGrid from "@/modules/watching/components/library/LibraryGrid";
import AddMediaModal from "@/modules/watching/components/modals/AddMediaModal";
import type { WatchingMedia } from "@/modules/watching/types";
import { useDebounce } from "@/shared/hooks/useDebounce";
import { Button } from "@/shared/components/ui/button";
import { createClient } from "@/infrastructure/supabase/client"
import { toast } from "@/shared/utils/toast";

const supabase = createClient();
const ITEMS_PER_PAGE = 32;

type MediaType = "all" | "film" | "serie" | "anime";
type SortKey   = "added" | "rating" | "title" | "year" | "favorite";

interface Props {
  initialItems: WatchingMedia[];
}

export default function LibraryClient({ initialItems }: Props) {
  const [allItems, setAllItems]       = useState(initialItems);
  const [mediaType, setMediaType]     = useState<MediaType>("all");
  const [sortBy, setSortBy]           = useState<SortKey>("added");
  const [search, setSearch]           = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [modalOpen, setModalOpen]     = useState(false);
  // track which media type to use in modal based on current filter
  const modalMediaType = mediaType === "all" ? "film" : mediaType as "film" | "serie" | "anime";

  const debouncedSearch = useDebounce(search, 300);

  const handleFilterChange = useCallback((filters: { mediaType: MediaType; sortBy: SortKey }) => {
    setMediaType(filters.mediaType);
    setSortBy(filters.sortBy);
    setCurrentPage(1);
  }, []);

  const { paginatedItems, totalPages, totalCount } = useMemo(() => {
    let result = [...allItems];

    if (mediaType !== "all") {
      result = result.filter(item => item.type === mediaType);
    }

    if (sortBy === "favorite") {
      result = result.filter(item => item.favorite === true);
    }

    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter(item =>
        item.title.toLowerCase().includes(q) ||
        item.original_title?.toLowerCase().includes(q) ||
        item.tags?.some(t => t.toLowerCase().includes(q))
      );
    }

    result.sort((a, b) => {
      switch (sortBy) {
        case "rating": return (b.user_rating || 0) - (a.user_rating || 0);
        case "title":  return a.title.localeCompare(b.title);
        case "year":   return (b.year || 0) - (a.year || 0);
        default:       return new Date(b.watched_at || 0).getTime() - new Date(a.watched_at || 0).getTime();
      }
    });

    const totalCount = result.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / ITEMS_PER_PAGE));
    const safePage   = Math.min(currentPage, totalPages);
    const start      = (safePage - 1) * ITEMS_PER_PAGE;
    const paginated  = result.slice(start, start + ITEMS_PER_PAGE);

    return { paginatedItems: paginated, totalPages, totalCount };
  }, [allItems, mediaType, sortBy, debouncedSearch, currentPage]);

  const handleUpdate = useCallback((updated: WatchingMedia) => {
    setAllItems(prev => prev.map(i => i.id === updated.id ? updated : i));
  }, []);

  // ✅ CORRIGÉ : Suppression en DB + état local
  const handleDelete = useCallback(async (itemId: string) => {
    try {
      const { error } = await supabase
        .schema("watching")
        .from("media_items")
        .delete()
        .eq("id", itemId);

      if (error) throw error;

      setAllItems(prev => prev.filter(i => i.id !== itemId));
      toast.success("Removed from library.");
    } catch (err) {
      console.error("Erreur suppression:", err);
      toast.error("Failed to delete item.");
    }
  }, []);

  const handleAdded = useCallback((item?: WatchingMedia) => {
    if (!item) return;
    setAllItems(prev => {
      if (prev.find(i => i.id === item.id)) return prev;
      return [item, ...prev];
    });
  }, []);

  return (
    <div className="space-y-6">
      {/* header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">My Library</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            {totalCount} media{totalCount > 1 ? "s" : ""}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* search */}
          <div className="relative w-full sm:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="Search for a title, or genre..."
              value={search}
              onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
              className="w-full bg-zinc-900/80 border border-zinc-800 rounded-xl pl-9 pr-9 py-2 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600/20 transition-all"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* add button */}
          <Button
            onClick={() => setModalOpen(true)}
            className="gap-2 bg-violet-600 hover:bg-violet-500 text-white shrink-0"
          >
            <Plus size={15} />
            Add
          </Button>
        </div>
      </div>

      {/* filters */}
      <LibraryFilters onFilterChange={handleFilterChange} />

      {/* grid */}
      <LibraryGrid items={paginatedItems} onUpdate={handleUpdate} onDelete={handleDelete} />

      {/* pagination */}
      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onChange={p => setCurrentPage(p)}
        />
      )}

      {/* add modal */}
      <AddMediaModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onAdded={handleAdded}
        defaultType={modalMediaType}
        listContext="library"
      />
    </div>
  );
}

// ─── pagination ───────────────────────────────────────────────────────────────

function Pagination({ currentPage, totalPages, onChange }: {
  currentPage: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  const pages = useMemo(() => {
    const delta = 2;
    const range: (number | "...")[] = [];
    const left  = Math.max(2, currentPage - delta);
    const right = Math.min(totalPages - 1, currentPage + delta);

    range.push(1);
    if (left > 2) range.push("...");
    for (let i = left; i <= right; i++) range.push(i);
    if (right < totalPages - 1) range.push("...");
    if (totalPages > 1) range.push(totalPages);

    return range;
  }, [currentPage, totalPages]);

  return (
    <div className="flex items-center justify-center gap-1.5 pt-4">
      <button
        onClick={() => onChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="px-3 py-1.5 text-sm rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        Previous
      </button>

      {pages.map((page, i) =>
        page === "..." ? (
          <span key={`ellipsis-${i}`} className="px-2 text-zinc-600">…</span>
        ) : (
          <button
            key={page}
            onClick={() => onChange(page as number)}
            className={`w-8 h-8 text-sm rounded-lg border transition-colors ${
              currentPage === page
                ? "bg-white text-black border-white font-semibold"
                : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-600"
            }`}
          >
            {page}
          </button>
        )
      )}

      <button
        onClick={() => onChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="px-3 py-1.5 text-sm rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        Next
      </button>
    </div>
  );
}