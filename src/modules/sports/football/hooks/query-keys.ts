// =====================================================
// FOOTBALL QUERY KEYS
// =====================================================

export const FOOTBALL_KEYS = {
  all: ['football'] as const,
  bestXi: () => [...FOOTBALL_KEYS.all, 'best-xi'] as const,
  teams: () => [...FOOTBALL_KEYS.all, 'teams'] as const,
  match: (externalId: number) => [...FOOTBALL_KEYS.all, 'match', externalId] as const,
  fanLog: (externalId: number) => [...FOOTBALL_KEYS.all, 'fan-log', externalId] as const,
  fanLogList: () => [...FOOTBALL_KEYS.all, 'fan-log-list'] as const,
  prediction: (externalId: number) => [...FOOTBALL_KEYS.all, 'prediction', externalId] as const,
  userPredictions: () => [...FOOTBALL_KEYS.all, 'user-predictions'] as const,
  upcoming: (teamExternalIds: string[]) => [...FOOTBALL_KEYS.all, 'upcoming', ...teamExternalIds] as const,
  recent: (teamExternalIds: string[]) => [...FOOTBALL_KEYS.all, 'recent', ...teamExternalIds] as const,
  followedCompetitions: () => [...FOOTBALL_KEYS.all, 'followed-competitions'] as const,
  allCompetitions: () => [...FOOTBALL_KEYS.all, 'all-competitions'] as const,
  teamSearch: (query: string) => [...FOOTBALL_KEYS.all, 'team-search', query] as const,
  scorers: (code: string) => [...FOOTBALL_KEYS.all, 'scorers', code] as const,
  teamStats: (teamExternalId: string) => [...FOOTBALL_KEYS.all, 'team-stats', teamExternalId] as const,
  standings: (competitionId: string) => [...FOOTBALL_KEYS.all, 'standings', competitionId] as const,
  competitionMatches: (competitionId: string) => [...FOOTBALL_KEYS.all, 'competition-matches', competitionId] as const,
  competition: (id: string) => [...FOOTBALL_KEYS.all, 'competition', id] as const,
  winners: (competitionId: string) => [...FOOTBALL_KEYS.all, 'winners', competitionId] as const,
  teamFull: (externalId: string) => [...FOOTBALL_KEYS.all, 'team-full', externalId] as const,
  teamMatches: (externalId: string) => [...FOOTBALL_KEYS.all, 'team-matches', externalId] as const,
} as const;