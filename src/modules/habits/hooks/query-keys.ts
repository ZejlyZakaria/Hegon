export const HABIT_KEYS = {
  all:              ['habits'] as const,
  lists:            () => [...HABIT_KEYS.all, 'list'] as const,
  today:            (date: string) => [...HABIT_KEYS.all, 'today', date] as const,
  completionsRange: (habitId: string, from: string, to: string) =>
    [...HABIT_KEYS.all, 'completions', habitId, from, to] as const,
  heatmap:          (from: string, to: string) => [...HABIT_KEYS.all, 'heatmap', from, to] as const,
  skips:            (scope: string) => [...HABIT_KEYS.all, 'skips', scope] as const,
  pauses:           (scope: string) => [...HABIT_KEYS.all, 'pauses', scope] as const,
  freezes:          (scope: string) => [...HABIT_KEYS.all, 'freezes', scope] as const,
} as const;
