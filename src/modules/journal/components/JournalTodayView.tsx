"use client";

import { useJournalToday, useCreateEntry, useUpdateEntry } from "../hooks/useJournalToday";
import { MoodPicker } from "./MoodPicker";
import { JournalEditor } from "./JournalEditor";
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-text-tertiary">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-6">
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
    </div>
  );
}

// Will be wired to real data in Phase 3 (cross-module queries)
function TodayContext() {
  const pills = [
    { label: "3 habits ✓" },
    { label: "2 tasks ✓" },
    { label: "Read 10 books — 40%" },
  ];

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-text-tertiary">Today&apos;s context</p>
      <div className="flex flex-wrap gap-2">
        {pills.map((pill, i) => (
          <span key={i} className="px-2.5 py-1 text-xs bg-surface-2 text-text-secondary rounded-md">
            {pill.label}
          </span>
        ))}
      </div>
    </div>
  );
}
