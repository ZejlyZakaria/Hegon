"use client";

import { useState } from "react";
import type { BookTab, BookStatus } from "../types";
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

const SKY = "#0ea5e9";

export function BooksPage() {
  const [activeTab, setActiveTab] = useState<BookTab>("reading");
  const [modalOpen, setModalOpen] = useState(false);

  const { data: stats, isLoading: statsLoading } = useBookStats();

  const isEmpty = !statsLoading && stats?.total === 0;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-5 pb-4 shrink-0 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary leading-tight">Books</h1>
          <p className="text-xs text-text-tertiary mt-0.5">Read deeply. Think clearly.</p>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="h-8 px-3 text-sm font-medium text-white rounded-md shrink-0"
          style={{ backgroundColor: SKY }}
        >
          + New Book
        </button>
      </div>

      {isEmpty ? (
        <BooksEmptyState
          showAddButton
          onAddClick={() => setModalOpen(true)}
        />
      ) : (
        <>
          {/* Stats zone */}
          <div className="px-4 shrink-0">
            <BooksStatsZone />
          </div>

          {/* Tabs */}
          <div className="flex items-center border-b border-border-default px-4 shrink-0">
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
                      className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                      style={{ backgroundColor: SKY }}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Main layout */}
          <div className="flex flex-1 min-h-0 overflow-hidden">
            {/* Content */}
            <div className="flex-1 min-w-0 overflow-y-auto px-4 py-4">
              <BooksSection
                status={TAB_TO_STATUS[activeTab]}
                showSearch
                showSort
              />
            </div>

            {/* Right panel */}
            <div className="w-72 shrink-0 border-l border-white/5 overflow-y-auto p-4">
              <BooksRightPanel />
            </div>
          </div>
        </>
      )}

      <AddBookModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
