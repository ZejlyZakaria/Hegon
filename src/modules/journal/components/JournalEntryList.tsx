"use client";

import { useState, useMemo } from "react";
import { Search, X, Target } from "lucide-react";
import { Input } from "@/shared/components/ui/input";
import { StaggerList, StaggerItem } from "@/shared/components/ui/motion";
import { useGoals } from "@/modules/goals/hooks/useGoals";
import { useJournalEntries } from "../hooks/useJournalEntry";
import { useDebounce } from "@/shared/hooks/useDebounce";
import { formatEntryDate, getPreview } from "../lib/journal-utils";
import { MOOD_CONFIG } from "../types";
import { JournalEmptyState } from "./JournalEmptyState";
import { JournalEntryListSkeleton } from "./JournalSkeleton";
import type { JournalMood, JournalEntry } from "../types";

const ACCENT = "var(--color-accent-journal-vivid)";
const GOALS = "var(--color-accent-goals)";

interface JournalEntryListProps {
  onSelectEntry: (entry: JournalEntry) => void;
}

const MOOD_FILTERS: Array<{ value: JournalMood | 'all'; label: string }> = [
  { value: 'all',     label: 'All' },
  { value: 'calm',    label: 'Calm' },
  { value: 'good',    label: 'Good' },
  { value: 'neutral', label: 'Neutral' },
  { value: 'tired',   label: 'Tired' },
  { value: 'rough',   label: 'Rough' },
];

export function JournalEntryList({ onSelectEntry }: JournalEntryListProps) {
  const [search, setSearch] = useState("");
  const [moodFilter, setMoodFilter] = useState<JournalMood | 'all'>('all');
  const debouncedSearch = useDebounce(search, 300);

  const { data: entries, isLoading } = useJournalEntries({
    search: debouncedSearch || undefined,
    mood: moodFilter !== 'all' ? moodFilter : undefined,
  });

  const { data: goals = [] } = useGoals();
  const goalMap = useMemo(() => new Map(goals.map((g) => [g.id, g.title])), [goals]);

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Filters + search on same row */}
      <div className="flex items-center gap-2">
        {MOOD_FILTERS.map((filter) => {
          const isActive = moodFilter === filter.value;
          return (
            <button
              key={filter.value}
              type="button"
              onClick={() => setMoodFilter(filter.value)}
              className={`px-3 py-1.5 rounded-control text-sm transition-colors ${
                isActive
                  ? 'bg-surface-2 text-text-primary border border-border-default'
                  : 'bg-transparent text-text-tertiary hover:text-text-secondary hover:bg-surface-2'
              }`}
            >
              {filter.label}
            </button>
          );
        })}

        <div className="ml-auto relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
          <Input
            variant="tasks"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search entries..."
            className="pl-10 pr-10 h-9 py-0 w-48 text-xs bg-surface-2 hover:bg-surface-3 border-border-subtle focus:border-border-focus"
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
      </div>

      {/* Entries list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <JournalEntryListSkeleton />
        ) : entries?.length === 0 ? (
          !search && moodFilter === 'all' ? (
            <JournalEmptyState />
          ) : (
            <div className="flex flex-col items-center justify-center h-32 gap-2">
              <span className="text-text-tertiary">No entries found</span>
              <button
                type="button"
                onClick={() => { setSearch(""); setMoodFilter('all'); }}
                className="text-sm transition-colors"
                style={{ color: ACCENT }}
              >
                Clear filters
              </button>
            </div>
          )
        ) : (
          <StaggerList className="flex flex-col gap-2">
            {entries?.map((entry, i) => {
                const preview = getPreview(entry.content);
                const moodColor = entry.mood ? MOOD_CONFIG[entry.mood].color : 'var(--color-surface-3)';

                return (
                  <StaggerItem key={entry.id} index={i}>
                    <button
                      type="button"
                      onClick={() => onSelectEntry(entry)}
                      className="w-full text-left p-4 rounded-card surface-card hover:bg-surface-2 transition-colors duration-100"
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className="w-3 h-3 rounded-full mt-1 shrink-0"
                          style={{ backgroundColor: moodColor }}
                        />
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-medium text-text-primary mb-1">
                            {entry.title || formatEntryDate(entry.entry_date)}
                          </h3>
                          {preview && (
                            <p className="text-sm text-text-secondary line-clamp-2 mb-2">
                              {preview}
                            </p>
                          )}
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
                            {entry.goal_id && goalMap.get(entry.goal_id) && (
                              <>
                                <span>•</span>
                                <span className="inline-flex items-center gap-1" style={{ color: GOALS }}>
                                  <Target className="w-3 h-3" />
                                  <span className="max-w-32 truncate">{goalMap.get(entry.goal_id)}</span>
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  </StaggerItem>
                );
              })}
          </StaggerList>
        )}
      </div>
    </div>
  );
}
