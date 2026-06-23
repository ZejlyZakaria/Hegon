// =====================================================
// DATABASE TYPES
// =====================================================

export type JournalMood = 'calm' | 'good' | 'neutral' | 'tired' | 'rough';

// Snapshot of cross-module activity attached to an entry ("what I did that day").
export type JournalContextType = 'habits' | 'watching' | 'books';
export interface JournalContextItem {
  type:  JournalContextType;
  label: string;
}

export interface JournalEntry {
  id:         string;
  org_id:     string;
  user_id:    string;
  entry_date: string;       // 'YYYY-MM-DD'
  title:      string | null;
  content:    string;
  mood:       JournalMood | null;
  tags:       string[];
  goal_id:    string | null;
  context:    JournalContextItem[] | null;
  word_count: number;
  created_at: string;
  updated_at: string;
}

// =====================================================
// API INPUT TYPES
// =====================================================

export interface CreateJournalEntryInput {
  entry_date: string;       // 'YYYY-MM-DD'
  content?:   string;
  title?:     string | null;
  mood?:      JournalMood | null;
  tags?:      string[];
  goal_id?:   string | null;
  context?:   JournalContextItem[] | null;
}

export interface UpdateJournalEntryInput {
  id:       string;
  content?: string;
  title?:   string | null;
  mood?:    JournalMood | null;
  tags?:    string[];
  goal_id?: string | null;
  context?: JournalContextItem[] | null;
}

// =====================================================
// UI TYPES
// =====================================================

export type JournalTab = 'today' | 'all';

export interface JournalCalendarDay {
  entry_date: string;       // 'YYYY-MM-DD'
  mood:       JournalMood | null;
}

export interface JournalStreak {
  current: number;
  best:    number;
}

// Used in the All Entries list
export interface JournalEntryPreview {
  id:         string;
  entry_date: string;
  title:      string | null;
  mood:       JournalMood | null;
  preview:    string;       // first line of content
  word_count: number;
  tags:       string[];
}

// =====================================================
// EVENTS — important dates / reminders pinned to a date
// =====================================================

export type JournalEventType = 'reminder' | 'birthday' | 'anniversary' | 'deadline' | 'milestone';

export interface JournalEvent {
  id:         string;
  org_id:     string;
  user_id:    string;
  event_date: string;       // 'YYYY-MM-DD'
  title:      string;
  note:       string | null;
  type:       string;
  created_at: string;
  updated_at: string;
}

export interface CreateJournalEventInput {
  event_date: string;       // 'YYYY-MM-DD'
  title:      string;
  note?:      string | null;
  type?:      string;
}

// Mood display config
export const MOOD_CONFIG: Record<JournalMood, { label: string; color: string }> = {
  calm:    { label: 'Calm',    color: '#60a5fa' }, // blue-400
  good:    { label: 'Good',    color: '#4ade80' }, // green-400
  neutral: { label: 'Neutral', color: '#71717a' }, // zinc-500
  tired:   { label: 'Tired',   color: '#fb923c' }, // orange-400
  rough:   { label: 'Rough',   color: '#f87171' }, // red-400
};
