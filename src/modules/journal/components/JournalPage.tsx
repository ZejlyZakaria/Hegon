"use client";

import { useState, useCallback } from "react";
import { useJournalToday } from "../hooks/useJournalToday";
import { useJournalEntry } from "../hooks/useJournalEntry";
import { JournalTodayView } from "./JournalTodayView";
import { JournalEntryList } from "./JournalEntryList";
import { JournalEntryPanel } from "./JournalEntryPanel";
import { JournalRightPanel } from "./JournalRightPanel";
import { JournalStatsView } from "./JournalStatsView";
import { JournalLoadingSkeleton } from "./JournalSkeleton";
import { TabNav } from "@/shared/components/ui/tab-nav";
import type { JournalEntry } from "../types";

const ACCENT = "var(--color-accent-journal-vivid)";

type Tab = "today" | "all" | "stats";

export function JournalPage() {
  const [tab, setTab] = useState<Tab>("today");
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);

  // Hoisted here so we can gate the full page skeleton
  const { isLoading: todayLoading } = useJournalToday();

  // Live copy of the open entry so edits/links reflect in the panel.
  const { data: liveEntry } = useJournalEntry(selectedEntry?.entry_date ?? "");

  const handleSelectEntry = useCallback((entry: JournalEntry) => {
    setSelectedEntry(entry);
  }, []);

  const handleClosePanel = useCallback(() => {
    setSelectedEntry(null);
  }, []);

  if (todayLoading) return <JournalLoadingSkeleton />;

  return (
    <div className="flex min-h-full flex-col">
      {/* Full-width tab rail — flush under the TopBar, identical placement to every
          module (the page title was redundant with the "Life / Journal" breadcrumb). */}
      <div className="border-b border-border-subtle px-4 sm:px-6">
        <TabNav
          accent={ACCENT}
          activeKey={tab}
          items={[
            { key: "today", label: "Today",       onClick: () => { setTab("today"); setSelectedEntry(null); } },
            { key: "all",   label: "All Entries", onClick: () => { setTab("all");   setSelectedEntry(null); } },
            { key: "stats", label: "Stats",       onClick: () => { setTab("stats"); setSelectedEntry(null); } },
          ]}
        />
      </div>

      {/* Stats — full width, no right panel */}
      {tab === "stats" ? (
        <div className="px-4 py-4 sm:px-6 sm:py-6">
          <JournalStatsView />
        </div>
      ) : (
      /* Content row — stacks on mobile, centre + right panel on lg (like habits/goals) */
      <div className="flex flex-col gap-6 px-4 py-4 sm:px-6 sm:py-6 lg:flex-row lg:items-start">
        {/* ── Centre ──────────────────────────────── */}
        <div className="min-w-0 flex-1">
          {tab === "today" ? (
            <JournalTodayView />
          ) : (
            <JournalEntryList onSelectEntry={handleSelectEntry} />
          )}
        </div>

        {/* ── Right Panel — under the content on mobile, sidebar on lg ── */}
        <div className="w-full lg:w-72 lg:shrink-0">
          <JournalRightPanel />
        </div>
      </div>
      )}

      {/* Past-entry detail — sliding panel over the list */}
      <JournalEntryPanel entry={liveEntry ?? selectedEntry} onClose={handleClosePanel} />
    </div>
  );
}
