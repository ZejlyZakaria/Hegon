// =====================================================
// F1 QUERY KEYS
// =====================================================

export const F1_KEYS = {
  all: ['f1'] as const,
  nextRace: () => [...F1_KEYS.all, 'nextRace'] as const,
  upcomingRaces: () => [...F1_KEYS.all, 'upcomingRaces'] as const,
  recentRaces: () => [...F1_KEYS.all, 'recentRaces'] as const,
  driverStandings: (season: number) => [...F1_KEYS.all, 'driverStandings', season] as const,
  constructorStandings: (season: number) => [...F1_KEYS.all, 'constructorStandings', season] as const,
  userTeams: (userId: string) => [...F1_KEYS.all, 'userTeams', userId] as const,
} as const;
