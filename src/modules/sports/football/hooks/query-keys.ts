// =====================================================
// FOOTBALL QUERY KEYS
// =====================================================

export const FOOTBALL_KEYS = {
  all: ['football'] as const,
  page: () => [...FOOTBALL_KEYS.all, 'page'] as const,
  teams: () => [...FOOTBALL_KEYS.all, 'teams'] as const,
  match: (externalId: number) => [...FOOTBALL_KEYS.all, 'match', externalId] as const,
  fanLog: (externalId: number) => [...FOOTBALL_KEYS.all, 'fan-log', externalId] as const,
  prediction: (externalId: number) => [...FOOTBALL_KEYS.all, 'prediction', externalId] as const,
  upcoming: (teamExternalIds: string[]) => [...FOOTBALL_KEYS.all, 'upcoming', ...teamExternalIds] as const,
  recent: (teamExternalIds: string[]) => [...FOOTBALL_KEYS.all, 'recent', ...teamExternalIds] as const,
  followedCompetitions: () => [...FOOTBALL_KEYS.all, 'followed-competitions'] as const,
  scorers: (code: string) => [...FOOTBALL_KEYS.all, 'scorers', code] as const,
} as const;