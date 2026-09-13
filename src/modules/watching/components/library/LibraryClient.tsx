// components/watching/LibraryClient.tsx
"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { Plus } from "lucide-react";
import LibraryGrid from "@/modules/watching/components/library/LibraryGrid";
import { QuickAddPanel } from "@/modules/watching/components/shared/QuickAddPanel";
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
import { FilterSelect } from "@/shared/components/ui/filter-select";
import { WATCHING_ACCENT } from "@/modules/watching/ui";
import {
  queryLibrary,
  type LibraryTypeFilter,
  type LibraryStatusFilter,
  type LibrarySortKey,
} from "@/modules/watching/lib/library-view";

const ITEMS_PER_PAGE = 40;

type MediaType = LibraryTypeFilter;
type StatusKey = LibraryStatusFilter;
type SortKey   = LibrarySortKey;

const MEDIA_TYPES: { value: MediaType; label: string }[] = [
  { value: "all",   label: "All" },
  { value: "film",  label: "Films" },
  { value: "serie", label: "Series" },
  { value: "anime", label: "Animes" },
];

const STATUS_OPTIONS: { value: StatusKey; label: string }[] = [
  { value: "all",       label: "All statuses" },
  { value: "watching",  label: "Watching" },
  { value: "paused",    label: "Paused" },
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

  const debouncedSearch = useDebounce(search, 300);

  // Persist filter/sort/page to the in-memory store on every change, so the next
  // mount (e.g. returning from a detail page) restores exactly where the user was.
  useEffect(() => {
    setLibraryFilter({ type: mediaType, status, sort: sortBy, page: currentPage });
  }, [mediaType, status, sortBy, currentPage, setLibraryFilter]);

  // The whole pipeline is `queryLibrary` (lib/library-view.ts) — pure, tested. This component only
  // holds the knobs and hands them over.
  const { items: paginatedItems, totalPages } = useMemo(
    () => queryLibrary(allItems, { type: mediaType, status, sort: sortBy, search: debouncedSearch, page: currentPage, pageSize: ITEMS_PER_PAGE }),
    [allItems, mediaType, status, sortBy, debouncedSearch, currentPage],
  );


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
            <FilterSelect
              className="w-36"
              value={status}
              onChange={(v) => { setStatus(v); setCurrentPage(1); }}
              options={STATUS_OPTIONS}
              placeholder="Status"
              aria-label="Filter by status"
            />
            <FilterSelect
              className="w-36"
              value={sortBy}
              onChange={(v) => { setSortBy(v); setCurrentPage(1); }}
              options={SORT_OPTIONS}
              placeholder="Sort by..."
              aria-label="Sort by"
            />
            <Button variant="accent" style={WATCHING_ACCENT} onClick={() => setModalOpen(true)}>
              <Plus />
              Add
            </Button>
          </div>
        </div>

        {/* ── Mobile: filter select + Add  /  search + sort ── */}
        <div className="space-y-2 sm:hidden">
          <div className="flex items-center gap-2">
            {/* Width fixed to the widest option ("Animes") — avoids jitter on selection */}
            <FilterSelect
              className="w-28"
              value={mediaType}
              onChange={(v) => { setMediaType(v); setCurrentPage(1); }}
              options={MEDIA_TYPES}
              aria-label="Media type"
            />
            <FilterSelect
              className="w-32"
              value={status}
              onChange={(v) => { setStatus(v); setCurrentPage(1); }}
              options={STATUS_OPTIONS}
              aria-label="Filter by status"
            />
            <Button
              variant="accent"
              size="icon"
              style={WATCHING_ACCENT}
              onClick={() => setModalOpen(true)}
              aria-label="Add to library"
              className="ml-auto"
            >
              <Plus />
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
            <FilterSelect
              className="w-32 shrink-0"
              value={sortBy}
              onChange={(v) => { setSortBy(v); setCurrentPage(1); }}
              options={SORT_OPTIONS}
              placeholder="Sort by..."
              aria-label="Sort by"
            />
          </div>
        </div>

        {/* count — adapts to active type + status filter */}
        <p className="text-xs text-text-tertiary">
          {(() => {
            const base = allItems.filter(i =>
              (mediaType === "all" || i.type === mediaType) &&
              (status === "all"
                || (status === "watching" ? i.in_progress
                  : status === "paused" ? i.paused
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

      {/* quick add — search-first, pick-to-add, stays open */}
      <QuickAddPanel open={modalOpen} onClose={() => setModalOpen(false)} />

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
      <Button variant="quiet" size="sm" onClick={() => onChange(currentPage - 1)} disabled={currentPage === 1}>
        Previous
      </Button>

      {pages.map((page, i) =>
        page === "..." ? (
          <span key={`ellipsis-${i}`} className="px-2 text-text-tertiary">…</span>
        ) : (
          <Button
            key={page}
            variant={currentPage === page ? "contrast" : "quiet"}
            size="icon-sm"
            onClick={() => onChange(page as number)}
            aria-current={currentPage === page ? "page" : undefined}
          >
            {page}
          </Button>
        )
      )}

      <Button variant="quiet" size="sm" onClick={() => onChange(currentPage + 1)} disabled={currentPage === totalPages}>
        Next
      </Button>
    </div>
  );
}