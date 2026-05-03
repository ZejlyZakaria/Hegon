"use client";

import { useState, useEffect, startTransition } from "react";
import { motion } from "framer-motion";
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
import { BooksLoadingSkeleton } from "./BooksSkeleton";
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

  if (statsLoading) return <BooksLoadingSkeleton />;

  const isEmpty = stats?.total === 0;

  return (
    <div className="flex min-h-full flex-col px-6 py-5 space-y-4">
      {/* Header — always visible */}
      <motion.div
        className="flex items-start justify-between gap-4"
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
      >
        <div>
          <h1 className="text-xl font-bold leading-tight text-text-primary">Books</h1>
          <p className="mt-0.5 text-sm text-text-tertiary">Read deeply. Think clearly.</p>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="h-8 shrink-0 px-3 text-sm font-medium text-white rounded-md hover:opacity-90 transition-opacity"
          style={{ backgroundColor: SKY }}
        >
          + New Book
        </button>
      </motion.div>

      {isEmpty ? (
        <BooksEmptyState onAddClick={() => setModalOpen(true)} />
      ) : (
        <>
          {/* Stats zone */}
          <BooksStatsZone />

          {/* Main layout */}
          <div className="flex gap-6">
            <div className="min-w-0 flex-1 flex flex-col gap-4">
              {/* Tabs + search + sort */}
              <div className="flex items-center justify-between">
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
                </div>

                <div className="flex items-center gap-2 pb-1">
                  <div className="relative flex items-center">
                    <Search
                      size={14}
                      className="absolute left-2.5 text-text-tertiary pointer-events-none"
                    />
                    <Input
                      variant="tasks"
                      type="text"
                      placeholder="Search books…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="h-9 py-0 pl-8 w-48 text-xs bg-surface-1 hover:bg-surface-2 border-border-subtle focus:border-border-focus"
                    />
                  </div>
                  <Select value={sort} onValueChange={(v) => setSort(v as BookSort)}>
                    <SelectTrigger
                      variant="tasks"
                      className="h-9 w-36 text-xs bg-surface-1 hover:bg-surface-2 focus:border-border-focus"
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
        </>
      )}

      <AddBookModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
