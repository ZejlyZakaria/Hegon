"use client";

import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { useJournalToday, useUpdateEntry } from "../hooks/useJournalToday";
import { useJournalEntry } from "../hooks/useJournalEntry";
import { JournalTodayView } from "./JournalTodayView";
import { JournalEntryList } from "./JournalEntryList";
import { JournalEditor } from "./JournalEditor";
import { JournalRightPanel } from "./JournalRightPanel";
import { JournalLoadingSkeleton } from "./JournalSkeleton";
import type { JournalEntry } from "../types";

const ACCENT = "#f97316";

type Tab = "today" | "all";

export function JournalPage() {
  const [tab, setTab] = useState<Tab>("today");
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
  const updateEntry = useUpdateEntry();

  // Hoisted here so we can gate the full page skeleton
  const { isLoading: todayLoading } = useJournalToday();

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

  if (todayLoading) return <JournalLoadingSkeleton />;

  return (
    <div className="flex h-full overflow-hidden gap-6 pr-6">
      {/* ── Centre ──────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <motion.div
          className="flex items-center justify-between px-6 pt-5 pb-4 shrink-0"
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
        >
          <div>
            <h1 className="text-xl font-bold text-text-primary">Journal</h1>
            <p className="text-sm text-text-tertiary mt-0.5">
              Write. Reflect. Understand. Turn thoughts into clarity.
            </p>
          </div>
        </motion.div>

        {/* Tabs */}
        <div className="flex items-center px-6 shrink-0">
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
        <div className="flex-1 min-h-0 overflow-hidden pl-6 pt-4 pb-5">
          {tab === "today" ? (
            <JournalTodayView />
          ) : selectedEntry ? (
            <div className="flex flex-col h-full gap-4">
              <motion.button
                type="button"
                onClick={handleBack}
                className="flex items-center gap-1.5 text-sm text-text-tertiary hover:text-text-secondary transition-colors self-start"
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
              >
                <ArrowLeft className="w-4 h-4" />
                All Entries
              </motion.button>
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
