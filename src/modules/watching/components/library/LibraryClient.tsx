// components/watching/LibraryClient.tsx
"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { Plus } from "lucide-react";
import LibraryGrid from "@/modules/watching/components/library/LibraryGrid";
import AddMediaModal from "@/modules/watching/components/modals/AddMediaModal";
import type { WatchingMedia } from "@/modules/watching/types";
import { useDebounce } from "@/shared/hooks/useDebounce";
import { useLibrary } from "@/modules/watching/hooks/useLibrary";
import { useDeleteMedia } from "@/modules/watching/hooks/useDeleteMedia";
import { useWatchingUIStore } from "@/modules/watching/hooks/useWatchingUIStore";
import DeleteConfirmModal from "@/modules/watching/components/modals/DeleteConfirmModal";
import { toast } from "@/shared/utils/toast";
import { isDemoReadOnlyError } from "@/shared/utils/demo-guard";
import { Button } from "@/shared/components/ui/button";
import { SearchInput } from "@/shared/components/ui/search-input";
import { SegmentedControl } from "@/shared/components/ui/segmented-control";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
const ITEMS_PER_PAGE = 40;

type MediaType = "all" | "film" | "serie" | "anime";
type StatusKey = "all" | "watching" | "completed" | "dropped";
type SortKey   = "added" | "rating" | "title" | "year" | "favorite";

const MEDIA_TYPES: { value: MediaType; label: string }[] = [
  { value: "all",   label: "All" },
  { value: "film",  label: "Films" },
  { value: "serie", label: "Series" },
  { value: "anime", label: "Animes" },
];

const STATUS_OPTIONS: { value: StatusKey; label: string }[] = [
  { value: "all",       label: "All statuses" },
  { value: "watching",  label: "Watching" },
  { value: "completed", label: "Completed" },
  { value: "dropped",   label: "Dropped" },
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
  userId: string;
}

export default function LibraryClient({ initialItems, userId }: Props) {
  const deleteMediaMutation = useDeleteMedia();
  const setLibraryFilter = useWatchingUIStore((s) => s.setLibraryFilter);
  // Live query (seeded by the server list) → cross-surface adds/deletes reflect
  // immediately, no stale RSC cache.
  const { data: allItems = [] } = useLibrary(userId, initialItems);
  // Lazy-init from the in-memory store so Back from a detail page restores the view.
  // getState() (not a subscription) — we read once on mount, no re-render coupling.
  const [mediaType, setMediaType]     = useState<MediaType>(() => {
    const t = useWatchingUIStore.getState().libraryFilter.type;
    return t === "film" || t === "serie" || t === "anime" ? t : "all";
  });
  const [status, setStatus]           = useState<StatusKey>(() => {
    const s = useWatchingUIStore.getState().libraryFilter.status;
    return STATUS_OPTIONS.some(o => o.value === s) ? (s as StatusKey) : "all";
  });
  const [sortBy, setSortBy]           = useState<SortKey>(() => {
    const s = useWatchingUIStore.getState().libraryFilter.sort;
    return SORT_OPTIONS.some(o => o.value === s) ? (s as SortKey) : "added";
  });
  const [search, setSearch]           = useState("");
  const [currentPage, setCurrentPage] = useState(() => {
    const p = useWatchingUIStore.getState().libraryFilter.page;
    return Number.isInteger(p) && p > 0 ? p : 1;
  });
  const [modalOpen, setModalOpen]     = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const modalMediaType = mediaType === "all" ? "film" : mediaType as "film" | "serie" | "anime";

  const debouncedSearch = useDebounce(search, 300);

  // Persist filter/sort/page to the in-memory store on every change, so the next
  // mount (e.g. returning from a detail page) restores exactly where the user was.
  useEffect(() => {
    setLibraryFilter({ type: mediaType, status, sort: sortBy, page: currentPage });
  }, [mediaType, status, sortBy, currentPage, setLibraryFilter]);

  const { paginatedItems, totalPages } = useMemo(() => {
    let result = [...allItems];

    if (mediaType !== "all") {
      result = result.filter(item => item.type === mediaType);
    }

    if (status !== "all") {
      result = result.filter(item =>
        status === "watching"  ? item.in_progress
        : status === "completed" ? item.watched
        : status === "dropped"   ? item.dropped
        : true,
      );
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
        // In-progress / dropped items have no watched_at → fall back to updated_at.
        default:       return new Date(b.watched_at || b.updated_at || 0).getTime() - new Date(a.watched_at || a.updated_at || 0).getTime();
      }
    });

    const totalCount = result.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / ITEMS_PER_PAGE));
    const safePage   = Math.min(currentPage, totalPages);
    const start      = (safePage - 1) * ITEMS_PER_PAGE;
    const paginated  = result.slice(start, start + ITEMS_PER_PAGE);

    return { paginatedItems: paginated, totalPages, totalCount };
  }, [allItems, mediaType, status, sortBy, debouncedSearch, currentPage]);

  const handleDelete = useCallback(async (itemId: string) => {
    try {
      await deleteMediaMutation.mutateAsync(itemId);
      // The mutation invalidates WATCHING_KEYS.all → the library query refetches.
      toast.success("Removed from library.");
    } catch (err) {
      if (isDemoReadOnlyError(err)) return;
      toast.error("Failed to delete item.");
    }
  }, [deleteMediaMutation]);

  // Add mutation invalidates the watching cache → the library query refetches.
  const handleAdded = useCallback(() => {}, []);

  return (
    <div className="space-y-4">
      {/* header */}
      <div className="space-y-2">
        {/* ── Desktop: chips + search + sort + Add ── */}
        <div className="hidden items-center gap-3 sm:flex">
          <SegmentedControl
            size="md"
            value={mediaType}
            onChange={(v) => { setMediaType(v); setCurrentPage(1); }}
            items={MEDIA_TYPES.map(({ value, label }) => ({ value, label }))}
          />

          <div className="flex items-center gap-2 ml-auto">
            <SearchInput
              containerClassName="w-56"
              placeholder="Search..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
              onClear={() => { setSearch(""); setCurrentPage(1); }}
            />
            <Select value={status} onValueChange={v => { setStatus(v as StatusKey); setCurrentPage(1); }}>
              <SelectTrigger className="w-36 h-9 bg-surface-1 border-border-subtle text-text-secondary text-xs hover:border-border-default focus:ring-0 focus:ring-offset-0 transition-colors">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="bg-surface-3 border-border-strong text-text-secondary">
                {STATUS_OPTIONS.map(({ value, label }) => (
                  <SelectItem key={value} value={value} className="text-sm focus:bg-surface-2 focus:text-text-primary cursor-pointer">
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            <Select value={status} onValueChange={(v) => { setStatus(v as StatusKey); setCurrentPage(1); }}>
              <SelectTrigger className="h-9 w-32 bg-surface-1 border-border-subtle text-text-secondary text-sm focus:ring-0 focus:ring-offset-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-surface-3 border-border-strong text-text-secondary">
                {STATUS_OPTIONS.map(({ value, label }) => (
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

        {/* count — adapts to active type + status filter */}
        <p className="text-xs text-text-tertiary">
          {(() => {
            const base = allItems.filter(i =>
              (mediaType === "all" || i.type === mediaType) &&
              (status === "all"
                || (status === "watching" ? i.in_progress
                  : status === "completed" ? i.watched
                  : i.dropped)),
            );
            const noun = mediaType === "film" ? "films"
              : mediaType === "serie" ? "series"
              : mediaType === "anime" ? "animes"
              : "titles";
            return `${base.length} ${noun}`;
          })()}
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