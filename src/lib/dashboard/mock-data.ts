// Dashboard mock data — replace with real API calls in the future

export const MOCK_TODAY_TASKS = [
  { id: "1", title: "Review pull request for auth module", priority: "high" as const, status: "in progress", project: "Second Brain" },
  { id: "2", title: "Write unit tests for task service", priority: "medium" as const, status: "to do", project: "Second Brain" },
  { id: "3", title: "Update API documentation", priority: "low" as const, status: "to do", project: "Second Brain" },
  { id: "4", title: "Fix sidebar collapse on mobile", priority: "high" as const, status: "in progress", project: "Second Brain" },
  { id: "5", title: "Deploy staging environment", priority: "critical" as const, status: "to do", project: "DevOps" },
  { id: "6", title: "Sync with design team on dashboard mockups", priority: "medium" as const, status: "done", project: "Design" },
];

export const MOCK_FOOTBALL = {
  nextMatch: {
    home_team: "Real Madrid",
    away_team: "FC Barcelona",
    home_crest: "https://crests.football-data.org/86.png",
    away_crest: "https://crests.football-data.org/81.png",
    competition: "La Liga",
    date: "2026-04-06T20:00:00",
    venue: "Santiago Bernabéu",
    is_home: true,
  },
};

export const MOCK_TENNIS = {
  nextMatch: {
    player: "C. Alcaraz",
    player_country: "ESP",
    opponent: "J. Sinner",
    opponent_country: "ITA",
    tournament: "Monte-Carlo Masters",
    round: "Semi-Final",
    date: "2026-04-13T14:00:00",
    surface: "clay" as const,
  },
};

export const MOCK_F1 = {
  nextRace: {
    name: "Chinese Grand Prix",
    circuit: "Shanghai International Circuit",
    country: "China",
    country_flag: "🇨🇳",
    date: "2026-04-20T07:00:00",
    round: 5,
    season: 2026,
  },
};

export const MOCK_WATCHING = {
  trendingMovie: {
    title: "Sinners",
    year: 2025,
    rating: 7.8,
    genre: "Horror / Thriller",
    director: "Ryan Coogler",
    color: "from-red-950 to-zinc-950",
    accent: "#ef4444",
  },
  ongoingSeries: {
    title: "The Last of Us",
    season: 2,
    episode: 3,
    total_episodes: 7,
    network: "HBO",
    next_episode: "2026-04-07",
    color: "from-amber-950 to-zinc-950",
    accent: "#f59e0b",
  },
  ongoingAnime: {
    title: "Solo Leveling",
    season: 2,
    episode: 11,
    total_episodes: 13,
    studio: "A-1 Pictures",
    color: "from-blue-950 to-zinc-950",
    accent: "#3b82f6",
  },
};
