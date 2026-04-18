// =====================================================
// TENNIS QUERY KEYS
// =====================================================

export const TENNIS_KEYS = {
  all: ['tennis'] as const,
  page: () => [...TENNIS_KEYS.all, 'page'] as const,
  players: () => [...TENNIS_KEYS.all, 'players'] as const,
} as const;
