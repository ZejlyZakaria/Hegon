import type { StatsRawItem } from "../../service";

export interface ComputedStats {
  availableYears: number[];
  counts: { film: number; serie: number; anime: number; total: number };
  hours: { film: number; serie: number; anime: number; total: number };
  avgRating: number | null;
  ratedCount: number;
  topGenres: { name: string; count: number }[];
  ratingDistribution: { score: number; count: number }[];
  topFavorites: StatsRawItem[];
  wrappedPosters: StatsRawItem[];
  activity: { label: string; count: number }[];
  streaks: {
    bestMonth: { label: string; count: number } | null;
    activeMonthsCount: number;
    bestYear: { label: string; count: number } | null;
  };
}

export interface Achievement {
  id: string;
  label: string;
  description: string;
  unlocked: boolean;
  progress: number; // 0–100
  progressLabel: string;
  color: string;
  icon: string; // emoji
}

function toH(min: number) {
  return Math.round((min / 60) * 10) / 10;
}

export function computeStats(items: StatsRawItem[], year: number | null): ComputedStats {
  const filtered = year
    ? items.filter((i) => i.watched_at && new Date(i.watched_at).getFullYear() === year)
    : items;

  const byType = (t: string) => filtered.filter((i) => i.type === t);

  const counts = {
    film:  byType("film").length,
    serie: byType("serie").length,
    anime: byType("anime").length,
    total: filtered.length,
  };

  const filmMin  = byType("film").reduce((s, i) => s + (i.runtime ?? 0), 0);
  const serieMin = byType("serie").reduce((s, i) => {
    const eps = i.season_episodes?.reduce((a, b) => a + b, 0) ?? i.episodes ?? 0;
    return s + eps * (i.runtime ?? 0);
  }, 0);
  const animeMin = byType("anime").reduce((s, i) => {
    const eps = i.season_episodes?.reduce((a, b) => a + b, 0) ?? i.episodes ?? 0;
    return s + eps * (i.runtime ?? 0);
  }, 0);

  const hours = {
    film:  toH(filmMin),
    serie: toH(serieMin),
    anime: toH(animeMin),
    total: toH(filmMin + serieMin + animeMin),
  };

  const rated = filtered.filter((i) => i.user_rating != null);
  const avgRating = rated.length > 0
    ? Math.round((rated.reduce((s, i) => s + (i.user_rating ?? 0), 0) / rated.length) * 10) / 10
    : null;

  const genreCount: Record<string, number> = {};
  for (const item of filtered) {
    for (const tag of item.tags ?? []) {
      genreCount[tag] = (genreCount[tag] ?? 0) + 1;
    }
  }
  const topGenres = Object.entries(genreCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6)
    .map(([name, count]) => ({ name, count }));

  const dist: Record<number, number> = {};
  for (const item of rated) {
    const bucket = Math.round(item.user_rating ?? 0);
    if (bucket >= 1 && bucket <= 10) dist[bucket] = (dist[bucket] ?? 0) + 1;
  }
  const ratingDistribution = Array.from({ length: 10 }, (_, i) => ({
    score: i + 1,
    count: dist[i + 1] ?? 0,
  }));

  const topFavorites = [...filtered]
    .filter((i) => i.favorite || (i.user_rating ?? 0) >= 8)
    .sort((a, b) => {
      if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
      return (b.user_rating ?? 0) - (a.user_rating ?? 0);
    })
    .slice(0, 3);

  const wrappedPosters = [...filtered]
    .filter((i) => i.poster_url)
    .sort((a, b) => {
      if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
      return (b.user_rating ?? 0) - (a.user_rating ?? 0);
    })
    .slice(0, 3);

  const availableYears = [
    ...new Set(
      items.filter((i) => i.watched_at).map((i) => new Date(i.watched_at!).getFullYear()),
    ),
  ].sort((a, b) => b - a);

  let activity: { label: string; count: number }[];
  if (year) {
    const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const counts12 = new Array(12).fill(0);
    for (const item of items) {
      if (!item.watched_at) continue;
      const d = new Date(item.watched_at);
      if (d.getFullYear() === year) counts12[d.getMonth()]++;
    }
    activity = MONTHS.map((label, i) => ({ label, count: counts12[i] }));
  } else {
    const yearCounts: Record<number, number> = {};
    for (const item of items) {
      if (!item.watched_at) continue;
      const y = new Date(item.watched_at).getFullYear();
      yearCounts[y] = (yearCounts[y] ?? 0) + 1;
    }
    activity = Object.keys(yearCounts)
      .map(Number)
      .sort((a, b) => a - b)
      .map((y) => ({ label: String(y), count: yearCounts[y] }));
  }

  // Streaks — computed from all-time items (not filtered by year)
  const MONTHS_FULL = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const monthCounts: Record<string, number> = {};
  for (const item of items) {
    if (!item.watched_at) continue;
    const d = new Date(item.watched_at);
    const key = `${MONTHS_FULL[d.getMonth()]} ${d.getFullYear()}`;
    monthCounts[key] = (monthCounts[key] ?? 0) + 1;
  }
  const monthEntries = Object.entries(monthCounts).sort(([, a], [, b]) => b - a);
  const bestMonth = monthEntries[0]
    ? { label: monthEntries[0][0], count: monthEntries[0][1] }
    : null;
  const activeMonthsCount = monthEntries.length;

  const yearCountsAll: Record<string, number> = {};
  for (const item of items) {
    if (!item.watched_at) continue;
    const y = String(new Date(item.watched_at).getFullYear());
    yearCountsAll[y] = (yearCountsAll[y] ?? 0) + 1;
  }
  const yearEntries = Object.entries(yearCountsAll).sort(([, a], [, b]) => b - a);
  const bestYear = yearEntries[0]
    ? { label: yearEntries[0][0], count: yearEntries[0][1] }
    : null;

  return {
    availableYears, counts, hours, avgRating,
    ratedCount: rated.length,
    topGenres, ratingDistribution, topFavorites, wrappedPosters, activity,
    streaks: { bestMonth, activeMonthsCount, bestYear },
  };
}

// Achievements are computed from ALL-TIME stats (ignore year filter)
export function computeAchievements(items: StatsRawItem[]): Achievement[] {
  const films  = items.filter((i) => i.type === "film").length;
  const series = items.filter((i) => i.type === "serie").length;
  const animes = items.filter((i) => i.type === "anime").length;
  const rated  = items.filter((i) => i.user_rating != null).length;
  const hasTen = items.some((i) => (i.user_rating ?? 0) >= 10);

  // Genre count
  const genreCount: Record<string, number> = {};
  for (const item of items) {
    for (const tag of item.tags ?? []) {
      genreCount[tag] = (genreCount[tag] ?? 0) + 1;
    }
  }
  const maxGenreCount = Math.max(0, ...Object.values(genreCount));

  // Best month
  const monthCounts: Record<string, number> = {};
  for (const item of items) {
    if (!item.watched_at) continue;
    const d = new Date(item.watched_at);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    monthCounts[key] = (monthCounts[key] ?? 0) + 1;
  }
  const bestMonthCount = Math.max(0, ...Object.values(monthCounts));

  const typesWatched = [films > 0, series > 0, animes > 0].filter(Boolean).length;

  return [
    {
      id: "century_club",
      label: "Century Club",
      description: "Watch 100 films",
      unlocked: films >= 100,
      progress: Math.min(100, Math.round((films / 100) * 100)),
      progressLabel: `${films}/100`,
      color: "var(--color-accent-watching-vivid)",
      icon: "🎬",
    },
    {
      id: "series_addict",
      label: "Series Addict",
      description: "Complete 15 series",
      unlocked: series >= 15,
      progress: Math.min(100, Math.round((series / 15) * 100)),
      progressLabel: `${series}/15`,
      color: "#818cf8",
      icon: "📺",
    },
    {
      id: "otaku",
      label: "Otaku",
      description: "Watch 20 animes",
      unlocked: animes >= 20,
      progress: Math.min(100, Math.round((animes / 20) * 100)),
      progressLabel: `${animes}/20`,
      color: "#fb923c",
      icon: "⛩️",
    },
    {
      id: "critic",
      label: "The Critic",
      description: "Rate 50 titles",
      unlocked: rated >= 50,
      progress: Math.min(100, Math.round((rated / 50) * 100)),
      progressLabel: `${rated}/50`,
      color: "#fbbf24",
      icon: "⭐",
    },
    {
      id: "all_timer",
      label: "All-Timer",
      description: "Give a perfect 10/10",
      unlocked: hasTen,
      progress: hasTen ? 100 : 0,
      progressLabel: hasTen ? "Achieved" : "Not yet",
      color: "#f59e0b",
      icon: "🏆",
    },
    {
      id: "genre_nerd",
      label: "Genre Nerd",
      description: "10+ titles in one genre",
      unlocked: maxGenreCount >= 10,
      progress: Math.min(100, Math.round((maxGenreCount / 10) * 100)),
      progressLabel: `${maxGenreCount}/10`,
      color: "#a855f7",
      icon: "🎭",
    },
    {
      id: "binge_month",
      label: "Binge Month",
      description: "Watch 10+ titles in one month",
      unlocked: bestMonthCount >= 10,
      progress: Math.min(100, Math.round((bestMonthCount / 10) * 100)),
      progressLabel: `${bestMonthCount}/10`,
      color: "#ef4444",
      icon: "🔥",
    },
    {
      id: "well_rounded",
      label: "Well-Rounded",
      description: "Watch films, series AND anime",
      unlocked: typesWatched === 3,
      progress: Math.round((typesWatched / 3) * 100),
      progressLabel: `${typesWatched}/3 types`,
      color: "#22c55e",
      icon: "🌐",
    },
  ];
}
