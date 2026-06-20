"use client";

import { useState, useEffect, startTransition } from "react";
import { Search, Heart, Plus } from "lucide-react";
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
import { FadeIn } from "@/shared/components/ui/motion";
import { LifeLayout } from "@/shared/components/layout/LifeLayout";
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

  // Search + filters — rendered on the tab row (desktop) OR a second row (mobile).
  const filtersBlock = (
    <>
      <div className="relative flex flex-1 items-center sm:w-48 sm:flex-none">
        <Search size={14} className="pointer-events-none absolute left-2.5 text-text-tertiary" />
        <Input
          variant="tasks"
          type="text"
          placeholder="Search books…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 w-full bg-surface-2 py-0 pl-8 text-xs hover:bg-surface-3 border-border-subtle focus:border-border-focus"
        />
      </div>
      <button
        type="button"
        onClick={() => setFavOnly((v) => !v)}
        title={favOnly ? "Show all" : "Show favorites only"}
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-control border transition-colors ${
          favOnly
            ? "border-red-500/40 bg-red-500/10 text-red-400"
            : "border-border-subtle bg-surface-1 text-text-tertiary hover:bg-surface-2 hover:text-text-secondary"
        }`}
      >
        <Heart size={14} className={favOnly ? "fill-red-400" : ""} />
      </button>
      <Select value={sort} onValueChange={(v) => setSort(v as BookSort)}>
        <SelectTrigger variant="tasks" className="h-9 w-36 text-xs bg-surface-2 hover:bg-surface-3 focus:border-border-focus">
          <SelectValue />
        </SelectTrigger>
        <SelectContent variant="tasks">
          {SORT_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );

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
          <FadeIn y={-6} className="border-b border-border-subtle px-4 sm:px-6">
            {/* Row 1 — tabs + action (mobile: icon-only "+" at right ; desktop: filters + full button) */}
            <div className="flex items-center gap-x-3">
              <TabNav
                accent={ACCENT}
                activeKey={isLibrary ? activeTab : view}
                items={[
                  ...TABS.map((t) => ({ key: t.id, label: t.label, onClick: () => { setView("library"); setActiveTab(t.id); } })),
                  ...DEST_TABS.map((d, i) => ({ key: d.id, label: d.label, onClick: () => setView(d.id), separatorBefore: i === 0 })),
                ]}
              />

              <div className="ml-auto flex shrink-0 items-center gap-2 pb-1.5">
                {isLibrary && (
                  <div className="hidden items-center gap-2 xl:flex">{filtersBlock}</div>
                )}
                <button
                  type="button"
                  onClick={() => setModalOpen(true)}
                  aria-label="New book"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control text-sm font-medium text-white transition-opacity hover:opacity-90 sm:w-auto sm:px-3 sm:whitespace-nowrap"
                  style={{ backgroundColor: ACCENT }}
                >
                  <Plus size={16} className="sm:hidden" />
                  <span className="hidden sm:inline">+ New Book</span>
                </button>
              </div>
            </div>

            {/* Row 2 (below xl) — search + filters (Books has more tabs than Goals,
                so the inline filters only fit alongside them at xl+) */}
            {isLibrary && (
              <div className="mt-1.5 flex items-center gap-2 pb-2 xl:hidden">{filtersBlock}</div>
            )}
          </FadeIn>

          {/* Content */}
          <div className="px-4 py-4 sm:px-6 sm:py-6">
            {view === "stats" ? (
            <BooksStatsPage />
          ) : view === "quotes" ? (
            <BooksQuotesWall />
          ) : (
            <LifeLayout
              right={activeTab === "reading" ? <BooksRightPanel /> : undefined}
            >
              <BooksSection
                status={TAB_TO_STATUS[activeTab]}
                sort={sort}
                search={search}
                favorite={favOnly || undefined}
                emptyMessage={favOnly ? "No favorites yet" : "No books found"}
              />
            </LifeLayout>
          )}
          </div>
        </>
      )}

      <AddBookModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
