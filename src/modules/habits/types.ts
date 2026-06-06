// =====================================================
// DATABASE TYPES
// =====================================================

export type HabitFrequency = 'daily' | 'weekly' | 'custom';

// Cross-module auto-completion: a habit can be driven by activity in another
// module (watching a film, later reading a book). Generic so Books plugs in free.
export type HabitSourceModule = 'watching' | 'books';

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

  // Cross-module source — null = manual habit (unchanged). source_key = optional
  // type filter (e.g. 'film' for "watch 1 film/week"); null = any activity counts.
  source_module: HabitSourceModule | null;
  source_key:    string | null;

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

export interface HabitSkip {
  id:         string;
  habit_id:   string;
  skip_date:  string;  // 'YYYY-MM-DD'
  reason:     string | null;
  created_at: string;
}

export interface HabitPause {
  id:          string;
  habit_id:    string;
  pause_start: string;        // 'YYYY-MM-DD'
  pause_end:   string | null; // null = open-ended (still paused)
  created_at:  string;
}

export interface HabitFreeze {
  id:          string;
  habit_id:    string;
  freeze_date: string;  // 'YYYY-MM-DD'
  created_at:  string;
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
  source_module?: HabitSourceModule | null;
  source_key?:    string | null;
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
  source_module?: HabitSourceModule | null;
  source_key?:    string | null;
}

export interface CompleteHabitInput {
  habit_id:       string;
  completed_date: string;  // 'YYYY-MM-DD'
  note?:          string | null;
}

// =====================================================
// UI TYPES
// =====================================================

export type HabitTab = 'today' | 'calendar' | 'stats' | 'all';

// Computed client-side for the Today view
export interface HabitWithStatus extends Habit {
  completed_today:  boolean;         // for weekly-any-day: "completed this week"
  completion_id:    string | null;
  completion_time:  string | null;  // created_at of the completion → "Done at HH:MM"
  at_risk:          boolean;
  skipped_today:    boolean;
  is_paused:        boolean;         // a pause period covers today
  current_streak:   number;          // weekly-any-day: counts in weeks
  best_streak:      number;
  // Weekly-any-day only: the date of this week's completion (for undo). null if none.
  week_completion_date?: string | null;
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
