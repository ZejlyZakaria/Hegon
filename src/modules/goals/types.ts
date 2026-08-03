// =====================================================
// DATABASE TYPES
// =====================================================

export type GoalStatus   = 'active' | 'completed' | 'paused' | 'abandoned';
export type GoalPriority = 'low' | 'medium' | 'high' | 'critical';
export type GoalCategory = 'career' | 'health' | 'finance' | 'growth' | 'lifestyle' | 'other';
export type ProgressMode = 'manual' | 'auto';
export type MilestoneStatus = 'pending' | 'completed';

// Cross-module metric — when set, an `auto` goal derives its progress from an
// activity count (e.g. films watched) instead of linked tasks. Module-agnostic
// so Books/Sport plug in later.
export type MetricModule = 'watching' | 'books' | 'football';
export type MetricPeriod = 'year' | 'all_time';

export interface Goal {
  id:            string;
  org_id:        string;
  user_id:       string;
  title:         string;
  description:   string | null;
  why:           string | null;   // motivation / north-star, surfaced on detail
  category:      GoalCategory | null;
  status:        GoalStatus;
  priority:      GoalPriority;
  progress:      number;
  progress_mode: ProgressMode;
  metric_module: MetricModule | null;
  metric_key:    string | null;   // WatchingMetricKey for the watching module
  metric_period: MetricPeriod | null;
  metric_year:   number | null;
  metric_target: number | null;
  target_date:   string | null;
  parent_goal_id: string | null;   // the bigger goal this one contributes to
  started_at:    string;
  completed_at:  string | null;
  created_at:    string;
  updated_at:    string;

  // Relations (joins)
  milestones?: GoalMilestone[];
  tasks?:      LinkedTask[];
}

export interface GoalMilestone {
  id:          string;
  goal_id:     string;
  title:       string;
  status:      MilestoneStatus;
  due_date:    string | null;
  completed_at: string | null;
  order_index: number;
  created_at:  string;
}

export interface LinkedTask {
  id:           string;
  title:        string;
  priority:     string;
  completed_at: string | null;
  due_date:     string | null;
  project_name: string | null;
  status?: {
    name:         string;
    color:        string | null;
    type:         import("@/modules/tasks/types").StatusType;
    is_completed: boolean;
  };
}

export interface LinkedHabit {
  id:              string;
  title:           string;
  icon:            string;
  color:           string;
  completed_today: boolean;
  current_streak:  number;
}

export interface AvailableTask {
  id:             string;
  title:          string;
  project_id:     string;
  project_name:   string;
  workspace_name: string;
}

export interface AvailableHabit {
  id:    string;
  title: string;
  icon:  string;
}

// =====================================================
// API INPUT TYPES
// =====================================================

export interface GoalMetricInput {
  metric_module?: MetricModule | null;
  metric_key?:    string | null;
  metric_period?: MetricPeriod | null;
  metric_year?:   number | null;
  metric_target?: number | null;
}

export interface CreateGoalInput extends GoalMetricInput {
  title:         string;
  description?:  string | null;
  why?:          string | null;
  category?:     GoalCategory | null;
  priority?:     GoalPriority;
  progress_mode?: ProgressMode;
  target_date?:  string | null;
}

export interface UpdateGoalInput extends GoalMetricInput {
  id: string;
  title?:         string;
  description?:   string | null;
  why?:           string | null;
  category?:      GoalCategory | null;
  status?:        GoalStatus;
  priority?:      GoalPriority;
  progress?:      number;
  progress_mode?: ProgressMode;
  target_date?:   string | null;
  parent_goal_id?: string | null;
  completed_at?:  string | null;
}

export interface CreateMilestoneInput {
  goal_id:     string;
  title:       string;
  due_date?:   string | null;
  order_index?: number;
}

export interface UpdateMilestoneInput {
  id:           string;
  title?:       string;
  status?:      MilestoneStatus;
  due_date?:    string | null;
  order_index?: number;
  completed_at?: string | null;
}

// =====================================================
// UI TYPES
// =====================================================

export type GoalFilter = 'all' | 'active' | 'completed' | GoalCategory;
export type GoalSort   = 'deadline' | 'progress' | 'priority' | 'created';

// Computed per category for the Life Compass
export interface CategoryStats {
  category:   GoalCategory;
  avgProgress: number;
  total:       number;
  atRisk:      number;  // active + target_date < now + 14 days + progress < 50
}

// One daily snapshot of a goal's progress — powers the Momentum sparkline.
export interface GoalProgressPoint {
  recorded_on: string;  // YYYY-MM-DD
  progress:    number;  // 0–100
}

// =====================================================
// REVIEW RITUAL
// =====================================================

// One goal's state captured inside a review's snapshot.
export interface ReviewGoalSnapshot {
  goal_id:  string;
  title:    string;
  progress: number;
}

export interface GoalReview {
  id:               string;
  org_id:           string;
  user_id:          string;
  period_start:     string;  // YYYY-MM-DD
  period_end:       string;  // YYYY-MM-DD
  wins:             string;
  blockers:         string;
  focus:            string;
  snapshot:         ReviewGoalSnapshot[];
  journal_entry_id: string | null;
  created_at:       string;
}

export interface CreateReviewInput {
  wins:          string;
  blockers:      string;
  focus:         string;
  saveToJournal: boolean;
}

// One row of the "what moved since last review" mirror — current progress + the
// delta against the previous review's snapshot. `delta` is null for goals that
// didn't exist at the last review (i.e. brand-new since then).
export interface ReviewMovement {
  goal_id:  string;
  title:    string;
  category: GoalCategory | null;
  progress: number;
  delta:    number | null;
  isNew:    boolean;
}

// The pre-computed material for a fresh review: the period it covers + the
// movement mirror, so the modal opens already filled with "what changed".
export interface ReviewDraft {
  period_start: string;  // YYYY-MM-DD
  period_end:   string;  // YYYY-MM-DD (today)
  movements:    ReviewMovement[];
}
