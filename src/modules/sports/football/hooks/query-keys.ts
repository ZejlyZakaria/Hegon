// =====================================================
// FOOTBALL QUERY KEYS
// =====================================================

export const FOOTBALL_KEYS = {
  all: ['football'] as const,
  page: () => [...FOOTBALL_KEYS.all, 'page'] as const,
  teams: () => [...FOOTBALL_KEYS.all, 'teams'] as const,
} as const;