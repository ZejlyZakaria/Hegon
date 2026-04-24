"use client";

import { useState } from "react";
import { Search, X } from "lucide-react";
import { useJournalEntries } from "../hooks/useJournalEntry";
import { useDebounce } from "@/shared/hooks/useDebounce";
import { MOOD_CONFIG } from "../types";
import type { JournalMood, JournalEntry } from "../types";

interface JournalEntryListProps {
  onSelectEntry: (entry: JournalEntry) => void;
}

const MOOD_FILTERS: Array<{ value: JournalMood | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'calm', label: 'Calm' },
  { value: 'good', label: 'Good' },
  { value: 'neutral', label: 'Neutral' },
  { value: 'tired', label: 'Tired' },
  { value: 'rough', label: 'Rough' },
];

export function JournalEntryList({ onSelectEntry }: JournalEntryListProps) {
  const [search, setSearch] = useState("");
  const [moodFilter, setMoodFilter] = useState<JournalMood | 'all'>('all');
  const debouncedSearch = useDebounce(search, 300);

  const { data: entries, isLoading } = useJournalEntries({
    search: debouncedSearch || undefined,
    mood: moodFilter !== 'all' ? moodFilter : undefined,
  });

  const formatDate = (dateStr: string) => {
    // Parse as local date to avoid UTC timezone shift
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }).format(date);
  };

  const getPreview = (content: string) => {
    const firstLine = content.split('\n')[0];
    return firstLine.length > 100 
      ? firstLine.slice(0, 100) + '...' 
      : firstLine;
  };

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Search and filters */}
      <div className="flex flex-col gap-3">
        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search entries..."
            className="w-full pl-10 pr-10 py-2 bg-surface-2 text-text-primary placeholder:text-text-tertiary rounded-md outline-none border border-border-subtle focus:border-border-focus transition-colors"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-secondary transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Mood filter */}
        <div className="flex items-center gap-2">
          {MOOD_FILTERS.map((filter) => {
            const isActive = moodFilter === filter.value;
            return (
              <button
                key={filter.value}
                type="button"
                onClick={() => setMoodFilter(filter.value)}
                className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                  isActive
                    ? 'bg-surface-2 text-text-primary border border-border-default'
                    : 'bg-transparent text-text-tertiary hover:text-text-secondary hover:bg-surface-2'
                }`}
              >
                {filter.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Entries list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <span className="text-text-tertiary">Loading...</span>
          </div>
        ) : entries?.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 gap-2">
            <span className="text-text-tertiary">No entries found</span>
            {(search || moodFilter !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setMoodFilter('all');
                }}
                className="text-sm text-text-secondary hover:text-text-primary transition-colors"
                style={{ color: '#f97316' }}
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {entries?.map((entry) => {
              const preview = getPreview(entry.content);
              const moodColor = entry.mood ? MOOD_CONFIG[entry.mood].color : '#27272a';

              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => onSelectEntry(entry)}
                  className="w-full text-left p-4 rounded-lg border border-border-subtle transition-colors"
                  style={{ backgroundColor: "var(--color-surface-1)" }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "var(--color-surface-2)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "var(--color-surface-1)";
                  }}
                >
                  <div className="flex items-start gap-3">
                    {/* Mood dot */}
                    <div
                      className="w-3 h-3 rounded-full mt-1 shrink-0"
                      style={{ backgroundColor: moodColor }}
                    />

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      {/* Date */}
                      <h3 className="text-sm font-medium text-text-primary mb-1">
                        {entry.title || formatDate(entry.entry_date)}
                      </h3>

                      {/* Preview */}
                      {preview && (
                        <p className="text-sm text-text-secondary line-clamp-2 mb-2">
                          {preview}
                        </p>
                      )}

                      {/* Meta: word count + tags */}
                      <div className="flex items-center gap-3 text-xs text-text-tertiary">
                        <span>{entry.word_count} words</span>
                        {entry.tags.length > 0 && (
                          <>
                            <span>•</span>
                            <div className="flex items-center gap-1">
                              {entry.tags.slice(0, 3).map((tag) => (
                                <span key={tag} className="text-text-tertiary">
                                  #{tag}
                                </span>
                              ))}
                              {entry.tags.length > 3 && (
                                <span>+{entry.tags.length - 3}</span>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}