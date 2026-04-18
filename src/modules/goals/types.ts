// =====================================================
// DATABASE TYPES
// =====================================================

export type GoalStatus   = 'active' | 'completed' | 'paused' | 'abandoned';
export type GoalPriority = 'low' | 'medium' | 'high' | 'critical';
export type GoalCategory = 'personal' | 'work' | 'health' | 'learning' | 'finance' | 'other';
export type ProgressMode = 'manual' | 'auto';
export type MilestoneStatus = 'pending' | 'completed';

export interface Goal {
  id:            string;
  org_id:        string;
  user_id:       string;
  title:         string;
  description:   string | null;
  category:      GoalCategory | null;
  status:        GoalStatus;
  priority:      GoalPriority;
  progress:      number;
  progress_mode: ProgressMode;
  target_date:   string | null;
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
  status?: {
    name:         string;
    color:        string | null;
    is_completed: boolean;
  };
}

// =====================================================
// API INPUT TYPES
// =====================================================

export interface CreateGoalInput {
  title:         string;
  description?:  string | null;
  category?:     GoalCategory | null;
  priority?:     GoalPriority;
  progress_mode?: ProgressMode;
  target_date?:  string | null;
}

export interface UpdateGoalInput {
  id: string;
  title?:         string;
  description?:   string | null;
  category?:      GoalCategory | null;
  status?:        GoalStatus;
  priority?:      GoalPriority;
  progress?:      number;
  progress_mode?: ProgressMode;
  target_date?:   string | null;
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
