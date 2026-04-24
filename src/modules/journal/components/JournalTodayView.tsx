"use client";

import { useEffect } from "react";
import { useJournalToday, useCreateEntry, useUpdateEntry } from "../hooks/useJournalToday";
import { MoodPicker } from "./MoodPicker";
import { JournalEditor } from "./JournalEditor";
import type { JournalMood } from "../types";

export function JournalTodayView() {
  const { data: entry, isLoading } = useJournalToday();
  const createEntry = useCreateEntry();
  const updateEntry = useUpdateEntry();

  const today = new Date().toISOString().split("T")[0];

  // Create entry if it doesn't exist
  useEffect(() => {
    if (!isLoading && !entry) {
      createEntry.mutate({
        entry_date: today,
        content: "",
        mood: null,
        tags: [],
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, entry, today]);

  const handleMoodChange = (mood: JournalMood) => {
    if (!entry) return;
    updateEntry.mutate({
      id: entry.id,
      mood,
    });
  };

  const handleSave = (data: { content: string; tags: string[] }) => {
    if (!entry) return;
    updateEntry.mutate({
      id: entry.id,
      content: data.content,
      tags: data.tags,
    });
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
      {/* Mood picker at top */}
      <div>
        <MoodPicker
          value={entry?.mood ?? null}
          onChange={handleMoodChange}
        />
      </div>

      {/* Editor - takes remaining height */}
      <div className="flex-1 min-h-0">
        <JournalEditor
          key={entry?.id ?? "new"}
          entry={entry ?? null}
          onSave={handleSave}
          placeholder="What's on your mind?"
        />
      </div>

      {/* Today's context pills - cross-module read-only */}
      <div className="pb-2">
        <TodayContext />
      </div>
    </div>
  );
}

// Cross-module context pills — read-only, auto-generated from other modules
// Will be wired to real data in Phase 3 (Supabase Realtime + cross-module queries)
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
          <span
            key={i}
            className="px-2.5 py-1 text-xs bg-surface-2 text-text-secondary rounded-md"
          >
            {pill.label}
          </span>
        ))}
      </div>
    </div>
  );
}