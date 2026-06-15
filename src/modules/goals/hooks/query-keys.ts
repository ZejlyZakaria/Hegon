export const GOAL_KEYS = {
  all:    ['goals'] as const,
  lists:  () => [...GOAL_KEYS.all, 'list'] as const,
  detail: (id: string) => [...GOAL_KEYS.all, 'detail', id] as const,
  // Nested under detail(id) so updateGoal's detail invalidation (prefix match)
  // refetches the momentum sparkline after any progress change.
  progressHistory: (id: string) => [...GOAL_KEYS.detail(id), 'progress-history'] as const,
} as const;

export const MILESTONE_KEYS = {
  all:    ['milestones'] as const,
  byGoal: (goalId: string) => [...MILESTONE_KEYS.all, 'goal', goalId] as const,
} as const;

export const LINKED_TASK_KEYS = {
  all:    ['goal-tasks'] as const,
  byGoal: (goalId: string) => [...LINKED_TASK_KEYS.all, 'goal', goalId] as const,
} as const;

export const LINKED_HABIT_KEYS = {
  all:    ['goal-habits'] as const,
  byGoal: (goalId: string) => [...LINKED_HABIT_KEYS.all, 'goal', goalId] as const,
} as const;

export const AVAILABLE_TASK_KEYS = {
  all: ['available-tasks-for-goal'] as const,
} as const;

export const AVAILABLE_HABIT_KEYS = {
  all: ['available-habits-for-goal'] as const,
} as const;

export const REVIEW_KEYS = {
  all:   ['goal-reviews'] as const,
  list:  () => [...REVIEW_KEYS.all, 'list'] as const,
  last:  () => [...REVIEW_KEYS.all, 'last'] as const,
  draft: () => [...REVIEW_KEYS.all, 'draft'] as const,
} as const;
