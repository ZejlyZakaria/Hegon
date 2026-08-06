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
  teamStats: (teamExternalId: string) => [...FOOTBALL_KEYS.all, 'team-stats', teamExternalId] as const,
  standings: (competitionId: string) => [...FOOTBALL_KEYS.all, 'standings', competitionId] as const,
  competitionMatches: (competitionId: string) => [...FOOTBALL_KEYS.all, 'competition-matches', competitionId] as const,
} as const;