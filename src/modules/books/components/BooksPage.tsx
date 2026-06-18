"use client";

import { useState, useEffect, startTransition } from "react";
import { Search, Heart } from "lucide-react";
import { useCommandCenter } from "@/modules/command-center/store";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Input } from "@/shared/components/ui/input";
import { TabNav } from "@/shared/components/ui/tab-nav";
import type { BookTab, BookStatus, BookSort } from "../types";
import { AddBookModal } from "./AddBookModal";
import { BooksEmptyState } from "./BooksEmptyState";
import { BooksRightPanel } from "./BooksRightPanel";
import { BooksSection } from "./BooksSection";
import { BooksLoadingSkeleton } from "./BooksSkeleton";
import { BooksStatsPage } from "./stats/BooksStatsPage";
import { BooksQuotesWall } from "./quotes/BooksQuotesWall";
import { useBookStats } from "../hooks/useBooks";
import { useBooksUIStore, type BooksView } from "../hooks/useBooksUIStore";

const TABS: { id: BookTab; label: string }[] = [
  { id: "reading",      label: "Reading" },
  { id: "want_to_read", label: "Want to Read" },
  { id: "completed",    label: "Completed" },
  { id: "all",          label: "All" },
];

// Destination tabs — sit after the status filters, behind a separator.
const DEST_TABS: { id: Exclude<BooksView, "library">; label: string }[] = [
  { id: "stats",  label: "Stats" },
  { id: "quotes", label: "Quotes" },
];

const TAB_TO_STATUS: Record<BookTab, BookStatus | undefined> = {
  reading:      "reading",
  want_to_read: "want_to_read",
  completed:    "read",
  all:          undefined,
};

const SORT_OPTIONS: Array<{ value: BookSort; label: string }> = [
  { value: "recently_added", label: "Recently Added" },
  { value: "title",          label: "Title" },
  { value: "rating",         label: "Rating" },
  { value: "most_read",      label: "Most Read" },
];

const ACCENT = "var(--color-accent-books-vivid)";


export function BooksPage() {
  // View + active tab persisted in-memory so Back from a detail page restores them.
  const view         = useBooksUIStore((s) => s.view);
  const setView      = useBooksUIStore((s) => s.setView);
  const activeTab    = useBooksUIStore((s) => s.activeTab);
  const setActiveTab = useBooksUIStore((s) => s.setActiveTab);
  const [search, setSearch]       = useState("");
  const [sort, setSort]           = useState<BookSort>("recently_added");
  const [favOnly, setFavOnly]     = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const { pendingAction, clearPendingAction } = useCommandCenter();
  useEffect(() => {
    if (pendingAction === "new-book") {
      startTransition(() => setModalOpen(true));
      clearPendingAction();
    }
  }, [pendingAction, clearPendingAction]);

  const { data: stats, isLoading: statsLoading } = useBookStats();

  if (statsLoading) return <BooksLoadingSkeleton />;

  const isEmpty = stats?.total === 0;
  const isLibrary = view === "library";

  return (
    <div className="flex min-h-full flex-col">
      {isEmpty ? (
        <div className="px-4 py-4 sm:px-6 sm:py-6">
          <BooksEmptyState onAddClick={() => setModalOpen(true)} />
        </div>
      ) : (
        <>
          {/* Full-width bar rail — status filters · Stats · Quotes + toolbar,
              flush under the TopBar (matches every module). */}
          <div className="border-b border-border-subtle px-4 sm:px-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <TabNav
              accent={ACCENT}
              activeKey={isLibrary ? activeTab : view}
              items={[
                ...TABS.map((t) => ({ key: t.id, label: t.label, onClick: () => { setView("library"); setActiveTab(t.id); } })),
                ...DEST_TABS.map((d, i) => ({ key: d.id, label: d.label, onClick: () => setView(d.id), separatorBefore: i === 0 })),
              ]}
            />

            {/* toolbar — library controls hidden on Stats/Quotes; New Book always shown */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:pb-1">
              {isLibrary && (
                <div className="relative flex items-center">
                  <Search size={14} className="absolute left-2.5 text-text-tertiary pointer-events-none" />
                  <Input
                    variant="tasks"
                    type="text"
                    placeholder="Search books…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-9 py-0 pl-8 w-full sm:w-48 text-xs bg-surface-2 hover:bg-surface-3 border-border-subtle focus:border-border-focus"
                  />
                </div>
              )}
              <div className="flex items-center gap-2">
                {isLibrary && (
                  <>
                    <button
                      type="button"
                      onClick={() => setFavOnly((v) => !v)}
                      title={favOnly ? "Show all" : "Show favorites only"}
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md border transition-colors ${
                        favOnly
                          ? "border-red-500/40 bg-red-500/10 text-red-400"
                          : "border-border-subtle bg-surface-1 text-text-tertiary hover:bg-surface-2 hover:text-text-secondary"
                      }`}
                    >
                      <Heart size={14} className={favOnly ? "fill-red-400" : ""} />
                    </button>
                    <Select value={sort} onValueChange={(v) => setSort(v as BookSort)}>
                      <SelectTrigger
                        variant="tasks"
                        className="h-9 w-36 text-xs bg-surface-2 hover:bg-surface-3 focus:border-border-focus"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent variant="tasks">
                        {SORT_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setModalOpen(true)}
                  className="h-9 flex-1 sm:flex-none shrink-0 rounded-md px-3 text-sm font-medium text-white transition-opacity hover:opacity-90 whitespace-nowrap"
                  style={{ backgroundColor: ACCENT }}
                >
                  + New Book
                </button>
              </div>
            </div>
            </div>
          </div>

          {/* Content */}
          <div className="px-4 py-4 sm:px-6 sm:py-6">
            {view === "stats" ? (
            <BooksStatsPage />
          ) : view === "quotes" ? (
            <BooksQuotesWall />
          ) : (
            <div className="flex flex-col gap-6 lg:flex-row">
              <div className="min-w-0 flex-1">
                <BooksSection
                  status={TAB_TO_STATUS[activeTab]}
                  sort={sort}
                  search={search}
                  favorite={favOnly || undefined}
                  emptyMessage={favOnly ? "No favorites yet" : "No books found"}
                />
              </div>

              {/* Right panel */}
              <div className="w-full lg:w-72 lg:shrink-0">
                <BooksRightPanel />
              </div>
            </div>
          )}
          </div>
        </>
      )}

      <AddBookModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
