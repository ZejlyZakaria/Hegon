"use client";

import { useState, useCallback } from "react";
import { ArrowLeft } from "lucide-react";
import { useUpdateEntry } from "../hooks/useJournalToday";
import { useJournalEntry } from "../hooks/useJournalEntry";
import { JournalTodayView } from "./JournalTodayView";
import { JournalEntryList } from "./JournalEntryList";
import { JournalEditor } from "./JournalEditor";
import { JournalRightPanel } from "./JournalRightPanel";
import type { JournalEntry } from "../types";

const ACCENT = "#f97316";

type Tab = "today" | "all";

export function JournalPage() {
  const [tab, setTab] = useState<Tab>("today");
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
  const updateEntry = useUpdateEntry();

  // When viewing a past entry in All Entries tab
  const { data: liveEntry } = useJournalEntry(
    selectedEntry?.entry_date ?? ""
  );

  const handleSelectEntry = useCallback((entry: JournalEntry) => {
    setSelectedEntry(entry);
  }, []);

  const handleBack = useCallback(() => {
    setSelectedEntry(null);
  }, []);

  const handleSavePastEntry = useCallback(
    (data: { content: string; tags: string[] }) => {
      const entry = liveEntry ?? selectedEntry;
      if (!entry) return;
      updateEntry.mutate({ id: entry.id, content: data.content, tags: data.tags });
    },
    [liveEntry, selectedEntry, updateEntry]
  );

  return (
    <div className="max-w-7xl mx-auto flex h-full overflow-hidden gap-6 pr-4">
      {/* ── Centre ──────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-5 pb-4 shrink-0">
          <div>
            <h1 className="text-xl font-bold text-text-primary">Journal</h1>
            <p className="text-sm text-text-tertiary mt-0.5">
              Write. Reflect. Understand. Turn thoughts into clarity.
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center px-4 shrink-0">
          {(["today", "all"] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setTab(t);
                setSelectedEntry(null);
              }}
              className="relative px-4 pb-2.5 pt-1 text-sm font-medium transition-colors"
              style={tab === t ? { color: "var(--color-text-primary)" } : undefined}
            >
              <span className={tab !== t ? "text-text-tertiary hover:text-text-secondary" : ""}>
                {t === "today" ? "Today" : "All Entries"}
              </span>
              {tab === t && (
                <span
                  className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-sm"
                  style={{ backgroundColor: ACCENT }}
                />
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-hidden pl-4 pt-4 pb-5">
          {tab === "today" ? (
            <JournalTodayView />
          ) : selectedEntry ? (
            <div className="flex flex-col h-full gap-4">
              <button
                type="button"
                onClick={handleBack}
                className="flex items-center gap-1.5 text-sm text-text-tertiary hover:text-text-secondary transition-colors self-start"
              >
                <ArrowLeft className="w-4 h-4" />
                All Entries
              </button>
              <div className="flex-1 min-h-0">
                <JournalEditor
                  key={(liveEntry ?? selectedEntry).id}
                  entry={liveEntry ?? selectedEntry}
                  onSave={handleSavePastEntry}
                />
              </div>
            </div>
          ) : (
            <JournalEntryList onSelectEntry={handleSelectEntry} />
          )}
        </div>
      </div>

      {/* ── Right Panel ─────────────────────────── */}
      <div className="w-72 shrink-0 overflow-y-auto pt-4 pb-5">
        <JournalRightPanel />
      </div>
    </div>
  );
}
