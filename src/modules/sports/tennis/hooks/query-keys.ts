// =====================================================
// TENNIS QUERY KEYS
// =====================================================

export const TENNIS_KEYS = {
  all: ['tennis'] as const,
  players: (userId: string) => [...TENNIS_KEYS.all, 'players', userId] as const,
  rankings: (playerId: string) => [...TENNIS_KEYS.all, 'rankings', playerId] as const,
  matches: (playerId: string) => [...TENNIS_KEYS.all, 'matches', playerId] as const,
  upcoming: (playerId: string) => [...TENNIS_KEYS.all, 'upcoming', playerId] as const,
} as const;
