"use client";

import { motion } from "framer-motion";
import { useJournalToday, useCreateEntry, useUpdateEntry } from "../hooks/useJournalToday";
import { MoodPicker } from "./MoodPicker";
import { JournalEditor } from "./JournalEditor";
import { JournalTodayViewSkeleton } from "./JournalSkeleton";
import type { JournalMood } from "../types";

// Timezone-safe: use local date, not UTC
function getTodayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function JournalTodayView() {
  const { data: entry, isLoading } = useJournalToday();
  const createEntry = useCreateEntry();
  const updateEntry = useUpdateEntry();

  // Create or update based on whether an entry exists yet
  const handleMoodChange = (mood: JournalMood) => {
    if (entry) {
      updateEntry.mutate({ id: entry.id, mood });
    } else {
      createEntry.mutate({ entry_date: getTodayLocal(), content: "", mood, tags: [] });
    }
  };

  const handleSave = (data: { content: string; tags: string[] }) => {
    if (entry) {
      updateEntry.mutate({ id: entry.id, content: data.content, tags: data.tags });
    } else if (data.content.trim()) {
      // Only create if there's actual content — avoid empty ghost entries
      createEntry.mutate({ entry_date: getTodayLocal(), content: data.content, mood: null, tags: data.tags });
    }
  };

  if (isLoading) return <JournalTodayViewSkeleton />;

  return (
    <motion.div
      className="flex flex-col h-full gap-6"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      {/* Mood picker */}
      <div>
        <MoodPicker
          value={entry?.mood ?? null}
          onChange={handleMoodChange}
        />
      </div>

      {/* Editor */}
      <div className="flex-1 min-h-0">
        <JournalEditor
          key={entry?.id ?? "new"}
          entry={entry ?? null}
          onSave={handleSave}
          placeholder="What's on your mind?"
        />
      </div>

      {/* Today's context pills */}
      <div className="pb-2">
        <TodayContext />
      </div>
    </motion.div>
  );
}

// Placeholder until Phase 3 wires real cross-module data
function TodayContext() {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-text-tertiary">Today&apos;s context</p>
      <p className="text-xs text-text-tertiary italic">
        Habits, tasks &amp; reading progress — coming in Phase 3.
      </p>
    </div>
  );
}
