// =====================================================
// FOOTBALL QUERY KEYS
// =====================================================

export const FOOTBALL_KEYS = {
  all: ['football'] as const,
  teams: (userId: string) => [...FOOTBALL_KEYS.all, 'teams', userId] as const,
  crests: (externalIds: string[]) => [...FOOTBALL_KEYS.all, 'crests', externalIds] as const,
  matches: (teamId: string) => [...FOOTBALL_KEYS.all, 'matches', teamId] as const,
  standings: (competitionId: string) => [...FOOTBALL_KEYS.all, 'standings', competitionId] as const,
  nextMatch: (teamId: string) => [...FOOTBALL_KEYS.all, 'nextMatch', teamId] as const,
} as const;