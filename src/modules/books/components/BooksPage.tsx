"use client";

import { useState, useEffect, startTransition } from "react";
import { Search } from "lucide-react";
import { useCommandCenter } from "@/modules/command-center/store";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Input } from "@/shared/components/ui/input";
import type { BookTab, BookStatus, BookSort } from "../types";
import { AddBookModal } from "./AddBookModal";
import { BooksEmptyState } from "./BooksEmptyState";
import { BooksRightPanel } from "./BooksRightPanel";
import { BooksSection } from "./BooksSection";
import { BooksStatsZone } from "./BooksStatsZone";
import { useBookStats } from "../hooks/useBooks";

const TABS: { id: BookTab; label: string }[] = [
  { id: "reading",      label: "Reading" },
  { id: "want_to_read", label: "Want to Read" },
  { id: "completed",    label: "Completed" },
  { id: "all",          label: "All" },
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

const SKY = "#0ea5e9";

function BooksTopbar({
  search,
  onSearchChange,
}: {
  search: string;
  onSearchChange: (v: string) => void;
}) {
  return (
    <div className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b border-white/4 bg-[#09090b]/80 px-4 backdrop-blur-sm">
      <div className="relative max-w-xs flex-1">
        <Search
          size={15}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[#71717a]"
        />
        <Input
          variant="tasks"
          type="text"
          placeholder="Search books..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 bg-surface-1 hover:bg-surface-2 border-border-subtle focus:border-border-focus"
        />
      </div>
    </div>
  );
}

export function BooksPage() {
  const [activeTab, setActiveTab] = useState<BookTab>("reading");
  const [search, setSearch]       = useState("");
  const [sort, setSort]           = useState<BookSort>("recently_added");
  const [modalOpen, setModalOpen] = useState(false);

  const { pendingAction, clearPendingAction } = useCommandCenter();
  useEffect(() => {
    if (pendingAction === "new-book") {
      startTransition(() => setModalOpen(true));
      clearPendingAction();
    }
  }, [pendingAction, clearPendingAction]);

  const { data: stats, isLoading: statsLoading } = useBookStats();
  const isEmpty = !statsLoading && stats?.total === 0;

  return (
    <div className="max-w-7xl mx-auto flex min-h-full flex-col">
      <BooksTopbar search={search} onSearchChange={setSearch} />

      {isEmpty ? (
        <div className="flex flex-1 items-center justify-center">
          <BooksEmptyState showAddButton onAddClick={() => setModalOpen(true)} />
        </div>
      ) : (
        <div className="space-y-4 px-4 py-5">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold leading-tight text-[#e2e2e6]">Books</h1>
              <p className="mt-0.5 text-sm text-[#71717a]">Read deeply. Think clearly.</p>
            </div>
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="h-8 shrink-0 px-3 text-sm font-medium text-white rounded-md hover:opacity-90 transition-opacity"
              style={{ backgroundColor: SKY }}
            >
              + New Book
            </button>
          </div>

          {/* Stats zone */}
          <BooksStatsZone />

          {/* Main layout — tabs+sort+content left, stats right */}
          <div className="flex gap-6">
            <div className="min-w-0 flex-1 flex flex-col gap-4">
              {/* Tabs + Sort */}
              <div className="flex items-center">
                {TABS.map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      type="button"
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className="relative px-4 pb-2.5 pt-1 text-sm font-medium transition-colors duration-100"
                      style={{ color: isActive ? "#e2e2e6" : "#71717a" }}
                    >
                      {tab.label}
                      {isActive && (
                        <span
                          className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-sm"
                          style={{ backgroundColor: SKY }}
                        />
                      )}
                    </button>
                  );
                })}

                <div className="ml-auto pb-1">
                  <Select value={sort} onValueChange={(v) => setSort(v as BookSort)}>
                    <SelectTrigger
                      variant="tasks"
                      className="h-8 w-40 bg-surface-1 hover:bg-surface-2 focus:border-border-focus"
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
                </div>
              </div>

              {/* Book grid */}
              <BooksSection
                status={TAB_TO_STATUS[activeTab]}
                sort={sort}
                search={search}
              />
            </div>

            {/* Right panel */}
            <div className="w-72 shrink-0">
              <BooksRightPanel />
            </div>
          </div>
        </div>
      )}

      <AddBookModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
