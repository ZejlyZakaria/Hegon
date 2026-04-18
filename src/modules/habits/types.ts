// =====================================================
// DATABASE TYPES
// =====================================================

export type HabitFrequency = 'daily' | 'weekly' | 'custom';

export interface Habit {
  id:          string;
  org_id:      string;
  user_id:     string;
  title:       string;
  description: string | null;
  frequency:   HabitFrequency;
  // Used by weekly (1 day) and custom (multiple days). [0..6] 0=Sun, 1=Mon … 6=Sat
  custom_days: number[] | null;
  goal_id:     string | null;
  color:       string;
  icon:        string;
  archived:    boolean;
  created_at:  string;
  updated_at:  string;

  // Relations (joins)
  goal?: { id: string; title: string } | null;
}

export interface HabitCompletion {
  id:             string;
  habit_id:       string;
  completed_date: string;  // 'YYYY-MM-DD'
  note:           string | null;
  created_at:     string;
}

// =====================================================
// API INPUT TYPES
// =====================================================

export interface CreateHabitInput {
  title:        string;
  description?: string | null;
  frequency?:   HabitFrequency;
  custom_days?: number[] | null;
  goal_id?:     string | null;
  color?:       string;
  icon?:        string;
}

export interface UpdateHabitInput {
  id:           string;
  title?:       string;
  description?: string | null;
  frequency?:   HabitFrequency;
  custom_days?: number[] | null;
  goal_id?:     string | null;
  color?:       string;
  icon?:        string;
}

export interface CompleteHabitInput {
  habit_id:       string;
  completed_date: string;  // 'YYYY-MM-DD'
  note?:          string | null;
}

// =====================================================
// UI TYPES
// =====================================================

export type HabitTab = 'today' | 'calendar' | 'all';

// Computed client-side for the Today view
export interface HabitWithStatus extends Habit {
  completed_today:  boolean;
  completion_id:    string | null;
  completion_time:  string | null;  // created_at of the completion → "Done at HH:MM"
  at_risk:          boolean;
  current_streak:   number;
  best_streak:      number;
}

export interface HabitStats {
  current_streak:      number;
  best_streak:         number;
  completion_rate_30d: number;  // 0–100
  total_completions:   number;
}

// For the GitHub-style All Habits heatmap
export interface HeatmapDay {
  date:  string;  // 'YYYY-MM-DD'
  count: number;
}
