// components/watching/LibraryClient.tsx
"use client";

import { useState, useMemo, useCallback } from "react";
import { Plus } from "lucide-react";
import LibraryGrid from "@/modules/watching/components/library/LibraryGrid";
import AddMediaModal from "@/modules/watching/components/modals/AddMediaModal";
import type { WatchingMedia } from "@/modules/watching/types";
import { useDebounce } from "@/shared/hooks/useDebounce";
import { useDeleteMedia } from "@/modules/watching/hooks/useDeleteMedia";
import DeleteConfirmModal from "@/modules/watching/components/modals/DeleteConfirmModal";
import { toast } from "@/shared/utils/toast";
import { cn } from "@/shared/utils/utils";
import { Button } from "@/shared/components/ui/button";
import { SearchInput } from "@/shared/components/ui/search-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
const ITEMS_PER_PAGE = 40;

type MediaType = "all" | "film" | "serie" | "anime";
type SortKey   = "added" | "rating" | "title" | "year" | "favorite";

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

interface Props {
  initialItems: WatchingMedia[];
}

export default function LibraryClient({ initialItems }: Props) {
  const deleteMediaMutation = useDeleteMedia();
  const [allItems, setAllItems]       = useState(initialItems);
  const [mediaType, setMediaType]     = useState<MediaType>("all");
  const [sortBy, setSortBy]           = useState<SortKey>("added");
  const [search, setSearch]           = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [modalOpen, setModalOpen]     = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const modalMediaType = mediaType === "all" ? "film" : mediaType as "film" | "serie" | "anime";

  const debouncedSearch = useDebounce(search, 300);

  const { paginatedItems, totalPages } = useMemo(() => {
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

  const handleDelete = useCallback(async (itemId: string) => {
    try {
      await deleteMediaMutation.mutateAsync(itemId);
      setAllItems(prev => prev.filter(i => i.id !== itemId));
      toast.success("Removed from library.");
    } catch {
      toast.error("Failed to delete item.");
    }
  }, [deleteMediaMutation]);

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
      <div className="space-y-2">
        {/* ── Desktop: chips + search + sort + Add ── */}
        <div className="hidden items-center gap-3 sm:flex">
          <div className="flex gap-2">
            {MEDIA_TYPES.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => { setMediaType(value); setCurrentPage(1); }}
                className={cn(
                  "rounded-md px-4 py-1.5 text-sm font-medium transition-[background-color,color] duration-150",
                  mediaType === value
                    ? "bg-white text-black"
                    : "bg-surface-1 border border-border-subtle text-text-tertiary hover:text-text-primary hover:border-border-default"
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <SearchInput
              containerClassName="w-56"
              placeholder="Search..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
              onClear={() => { setSearch(""); setCurrentPage(1); }}
            />
            <Select value={sortBy} onValueChange={v => { setSortBy(v as SortKey); setCurrentPage(1); }}>
              <SelectTrigger className="w-36 h-9 bg-surface-1 border-border-subtle text-text-secondary text-xs hover:border-border-default focus:ring-0 focus:ring-offset-0 transition-colors">
                <SelectValue placeholder="Sort by..." />
              </SelectTrigger>
              <SelectContent className="bg-surface-3 border-border-strong text-text-secondary">
                {SORT_OPTIONS.map(({ value, label }) => (
                  <SelectItem key={value} value={value} className="text-sm focus:bg-surface-2 focus:text-text-primary cursor-pointer">
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-1.5 rounded-lg px-3 h-9 text-xs font-semibold text-white shrink-0"
              style={{ backgroundColor: "var(--color-accent-watching)" }}
            >
              <Plus size={13} />
              Add
            </Button>
          </div>
        </div>

        {/* ── Mobile: filter select + Add  /  search + sort ── */}
        <div className="space-y-2 sm:hidden">
          <div className="flex items-center gap-2">
            {/* Width fixed to the widest option ("Animes") — avoids jitter on selection */}
            <Select value={mediaType} onValueChange={(v) => { setMediaType(v as typeof mediaType); setCurrentPage(1); }}>
              <SelectTrigger className="h-9 w-28 bg-surface-1 border-border-subtle text-text-secondary text-sm focus:ring-0 focus:ring-offset-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-surface-3 border-border-strong text-text-secondary">
                {MEDIA_TYPES.map(({ value, label }) => (
                  <SelectItem key={value} value={value} className="text-sm focus:bg-surface-2 focus:text-text-primary cursor-pointer">
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              onClick={() => setModalOpen(true)}
              aria-label="Add to library"
              className="ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-lg p-0 text-white"
              style={{ backgroundColor: "var(--color-accent-watching)" }}
            >
              <Plus size={16} />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <SearchInput
              containerClassName="flex-1"
              placeholder="Search..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
              onClear={() => { setSearch(""); setCurrentPage(1); }}
            />
            <Select value={sortBy} onValueChange={v => { setSortBy(v as SortKey); setCurrentPage(1); }}>
              <SelectTrigger className="h-9 w-32 shrink-0 bg-surface-1 border-border-subtle text-text-secondary text-xs focus:ring-0 focus:ring-offset-0">
                <SelectValue placeholder="Sort by..." />
              </SelectTrigger>
              <SelectContent className="bg-surface-3 border-border-strong text-text-secondary">
                {SORT_OPTIONS.map(({ value, label }) => (
                  <SelectItem key={value} value={value} className="text-sm focus:bg-surface-2 focus:text-text-primary cursor-pointer">
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* count — adapts to active filter */}
        <p className="text-xs text-text-tertiary">
          {mediaType === "all"
            ? `${allItems.length} titles`
            : mediaType === "film"
            ? `${allItems.filter(i => i.type === "film").length} films`
            : mediaType === "serie"
            ? `${allItems.filter(i => i.type === "serie").length} series`
            : `${allItems.filter(i => i.type === "anime").length} animes`}
        </p>
      </div>

      {/* grid */}
      <LibraryGrid items={paginatedItems} onDelete={(id) => setConfirmDeleteId(id)} />

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

      {/* delete confirmation */}
      <DeleteConfirmModal
        isOpen={confirmDeleteId !== null}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={async () => {
          if (confirmDeleteId) await handleDelete(confirmDeleteId);
          setConfirmDeleteId(null);
        }}
        title="Remove from library?"
        description="This will permanently delete this title from your library."
        isDeleting={deleteMediaMutation.isPending}
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
        type="button"
        onClick={() => onChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="px-3 py-1.5 text-sm rounded-lg bg-surface-1 border border-border-subtle text-text-tertiary hover:text-text-primary hover:border-border-default disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        Previous
      </button>

      {pages.map((page, i) =>
        page === "..." ? (
          <span key={`ellipsis-${i}`} className="px-2 text-text-tertiary">…</span>
        ) : (
          <button
            key={page}
            type="button"
            onClick={() => onChange(page as number)}
            className={`w-8 h-8 text-sm rounded-lg border transition-colors ${
              currentPage === page
                ? "bg-white text-black border-white font-semibold"
                : "bg-surface-1 border-border-subtle text-text-tertiary hover:text-text-primary hover:border-border-default"
            }`}
          >
            {page}
          </button>
        )
      )}

      <button
        type="button"
        onClick={() => onChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="px-3 py-1.5 text-sm rounded-lg bg-surface-1 border border-border-subtle text-text-tertiary hover:text-text-primary hover:border-border-default disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        Next
      </button>
    </div>
  );
}