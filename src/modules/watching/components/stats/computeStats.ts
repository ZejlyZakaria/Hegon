import type { StatsRawItem } from "../../service";
import type { Achievement } from "@/shared/components/achievements/types";

export interface ComputedStats {
  availableYears: number[];
  counts: { film: number; serie: number; anime: number; total: number };
  hours: { film: number; serie: number; anime: number; total: number };
  avgRating: number | null;
  ratedCount: number;
  topGenres: { name: string; count: number }[];
  ratingDistribution: { score: number; count: number }[];
  topFavorites: { item: StatsRawItem; seasonLabel: string | null; rating: number | null; seasonPoster: string | null }[];
  wrappedPosters: StatsRawItem[];
  activity: { label: string; count: number }[];
  streaks: {
    bestMonth: { label: string; count: number } | null;
    activeMonthsCount: number;
    bestYear: { label: string; count: number } | null;
  };
}

function toH(min: number) {
  return Math.round((min / 60) * 10) / 10;
}

// The date hours fall back to when a season has no explicit year: finish date
// (watched_at) when completed, last-progress date (updated_at) when in-progress.
function hoursDateOf(i: StatsRawItem): string | null {
  return i.watched ? i.watched_at : i.updated_at;
}

// Per-season hour contributions of a series/anime: each finished season's episodes
// attributed to the year you watched it (season_years, else the item's fallback
// year); the current in-progress season counts only the episodes watched so far.
// This is what makes a multi-year show (JJK S1→2021 … S3→2026) land in the right years.
function seasonContributions(i: StatsRawItem): { episodes: number; year: number | null }[] {
  const fallbackDate = hoursDateOf(i);
  const fallbackYear = fallbackDate ? new Date(fallbackDate).getFullYear() : null;
  const yearOf = (s: number) => i.season_years?.[String(s)] ?? fallbackYear;
  const seasons = i.season_episodes ?? [];

  // No per-season breakdown → single bucket on the fallback year.
  if (seasons.length === 0) {
    const eps = i.watched ? (i.episodes ?? 0) : (i.current_episode ?? 0);
    return [{ episodes: eps, year: fallbackYear }];
  }

  if (i.watched) {
    return seasons.map((eps, idx) => ({ episodes: eps, year: yearOf(idx + 1) }));
  }

  // In-progress: full finished seasons + the current partial season (live episodes).
  const cs = i.current_season ?? 1;
  const ce = i.current_episode ?? 0;
  const out: { episodes: number; year: number | null }[] = [];
  for (let s = 1; s < cs; s++) out.push({ episodes: seasons[s - 1] ?? 0, year: yearOf(s) });
  out.push({ episodes: ce, year: yearOf(cs) });
  return out;
}

// Years in which a title completed at least one season. A stamped season_years
// entry = a completed season; legacy fully-watched shows without stamps fall back
// to their finish year. The current in-progress partial season is NOT counted here
// (its hours accrue live, but it only bumps the title count once finished).
function completedSeasonYears(i: StatsRawItem): number[] {
  const stamped = Object.values(i.season_years ?? {});
  if (stamped.length > 0) return [...new Set(stamped)];
  if (i.watched && i.watched_at) return [new Date(i.watched_at).getFullYear()];
  return [];
}

// Does a title count toward a type/year total? Films: watched (in that year).
// Series/anime: completed a season (in that year). All-time = once per title.
function countsTitle(i: StatsRawItem, year: number | null): boolean {
  if (i.type === "film") {
    if (!i.watched) return false;
    if (!year) return true;
    return !!i.watched_at && new Date(i.watched_at).getFullYear() === year;
  }
  const ys = completedSeasonYears(i);
  return year ? ys.includes(year) : ys.length > 0;
}

// The season's own poster for the year shown — only when a SINGLE season
// represents that year on a multi-year show (so the Top Picks thumbnail matches
// the labelled season). Otherwise null → fall back to the show poster.
function seasonPosterFor(i: StatsRawItem, year: number | null): string | null {
  if (!year || i.type === "film") return null;
  const isMultiYear = new Set(Object.values(i.season_years ?? {})).size >= 2;
  if (!isMultiYear) return null;
  const seasonsInY = Object.entries(i.season_years ?? {})
    .filter(([, y]) => y === year)
    .map(([s]) => Number(s));
  if (seasonsInY.length !== 1) return null;
  return i.season_posters?.[seasonsInY[0] - 1] ?? null;
}

// For a given year, which season(s) of this title were watched → "Season 3",
// "Seasons 1–8", or null (film / legacy / all-time → show the whole title).
function seasonLabelFor(i: StatsRawItem, year: number | null): string | null {
  if (!year || i.type === "film") return null;
  const seasons = Object.entries(i.season_years ?? {})
    .filter(([, y]) => y === year)
    .map(([s]) => Number(s))
    .sort((a, b) => a - b);
  if (seasons.length === 0) return null;
  if (seasons.length === 1) return `Season ${seasons[0]}`;
  const contiguous = seasons.every((s, idx) => idx === 0 || s === seasons[idx - 1] + 1);
  return contiguous ? `Seasons ${seasons[0]}–${seasons[seasons.length - 1]}` : `${seasons.length} seasons`;
}

// Rating to rank/show a title by for a given year. Smart filter: if the whole
// show was watched in a SINGLE year (all seasons same year), use the title's
// overall rating — even if seasons were rated individually. Only when the show
// spans MULTIPLE years do we use the rating of the season watched that year.
// Films and all-time always use the title rating.
function effectiveRating(i: StatsRawItem, year: number | null): number | null {
  if (i.type === "film" || !year) return i.user_rating;
  const isMultiYear = new Set(Object.values(i.season_years ?? {})).size >= 2;
  if (!isMultiYear) return i.user_rating;
  const seasonsInY = Object.entries(i.season_years ?? {})
    .filter(([, y]) => y === year)
    .map(([s]) => Number(s));
  const ratings = seasonsInY
    .map((s) => i.season_ratings?.[String(s)])
    .filter((r): r is number => r != null);
  if (ratings.length === 0) return i.user_rating;
  return Math.max(...ratings);
}

export function computeStats(items: StatsRawItem[], year: number | null): ComputedStats {
  // Genres / ratings base — completed titles, dated by watched_at.
  const completed = items.filter((i) => i.watched);
  const filtered = year
    ? completed.filter((i) => i.watched_at && new Date(i.watched_at).getFullYear() === year)
    : completed;

  // Counts — season-aware per year: a title counts in each year it completed a
  // season (films: the year watched). All-time = distinct titles.
  const countItems = items.filter((i) => countsTitle(i, year));
  const counts = {
    film:  countItems.filter((i) => i.type === "film").length,
    serie: countItems.filter((i) => i.type === "serie").length,
    anime: countItems.filter((i) => i.type === "anime").length,
    total: countItems.length,
  };

  // Hours Watched — completed films + series/anime episodes ACTUALLY watched (full
  // when completed, current progress when in-progress), each × the real runtime.
  // Completed titles are dated by watched_at, in-progress ones by updated_at.
  const inHoursYear = (i: StatsRawItem) => {
    if (!year) return true;
    const d = hoursDateOf(i);
    return !!d && new Date(d).getFullYear() === year;
  };

  const filmMin = items
    .filter((i) => i.type === "film" && i.watched && inHoursYear(i))
    .reduce((s, i) => s + (i.runtime ?? 0), 0);

  // Series/anime: distribute each season's episodes to ITS year, then keep the
  // ones matching the filter. This is why the year total is now accurate per show.
  const tvMinutes = (type: string) =>
    items
      .filter((i) => i.type === type && (i.watched || i.in_progress))
      .reduce((sum, i) => {
        const rt = i.runtime ?? 0;
        return sum + seasonContributions(i)
          .filter((c) => !year || c.year === year)
          .reduce((a, c) => a + c.episodes * rt, 0);
      }, 0);

  const serieMin = tvMinutes("serie");
  const animeMin = tvMinutes("anime");

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

  // Top Picks — season-aware: a show appears in the year it had a season watched,
  // labelled with that season (e.g. JJK in 2026 → "Season 3"), ranked by the
  // season's own rating when set, else the title rating.
  const topFavorites = items
    .map((item) => ({ item, rating: effectiveRating(item, year), seasonLabel: seasonLabelFor(item, year), seasonPoster: seasonPosterFor(item, year) }))
    .filter((x) => countsTitle(x.item, year) && (x.item.favorite || (x.rating ?? 0) >= 8))
    .sort((a, b) => {
      if (a.item.favorite !== b.item.favorite) return a.item.favorite ? -1 : 1;
      return (b.rating ?? 0) - (a.rating ?? 0);
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
    ...new Set([
      ...completed.filter((i) => i.watched_at).map((i) => new Date(i.watched_at!).getFullYear()),
      ...items.filter((i) => i.in_progress && i.updated_at).map((i) => new Date(i.updated_at!).getFullYear()),
      ...items.flatMap((i) => Object.values(i.season_years ?? {})),
    ]),
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
  // Achievements count COMPLETED titles only (rawData now also carries in-progress).
  const completed = items.filter((i) => i.watched);
  const films  = completed.filter((i) => i.type === "film").length;
  const series = completed.filter((i) => i.type === "serie").length;
  const animes = completed.filter((i) => i.type === "anime").length;
  const rated  = completed.filter((i) => i.user_rating != null).length;
  const hasTen = completed.some((i) => (i.user_rating ?? 0) >= 10);

  // Genre count
  const genreCount: Record<string, number> = {};
  for (const item of completed) {
    for (const tag of item.tags ?? []) {
      genreCount[tag] = (genreCount[tag] ?? 0) + 1;
    }
  }
  const maxGenreCount = Math.max(0, ...Object.values(genreCount));

  // Best month
  const monthCounts: Record<string, number> = {};
  for (const item of completed) {
    if (!item.watched_at) continue;
    const d = new Date(item.watched_at);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    monthCounts[key] = (monthCounts[key] ?? 0) + 1;
  }
  const bestMonthCount = Math.max(0, ...Object.values(monthCounts));

  const typesWatched = [films > 0, series > 0, animes > 0].filter(Boolean).length;

  return [
    {
      key: "century_club",
      name: "Century Club",
      description: "Watch 100 films",
      icon: "clapperboard",
      color: "var(--color-accent-watching-vivid)",
      unlocked: films >= 100,
      progress: Math.min(1, films / 100),
      progressLabel: `${films}/100`,
    },
    {
      key: "series_addict",
      name: "Series Addict",
      description: "Complete 15 series",
      icon: "tv",
      color: "#818cf8",
      unlocked: series >= 15,
      progress: Math.min(1, series / 15),
      progressLabel: `${series}/15`,
    },
    {
      key: "otaku",
      name: "Otaku",
      description: "Watch 20 animes",
      icon: "sparkles",
      color: "#fb923c",
      unlocked: animes >= 20,
      progress: Math.min(1, animes / 20),
      progressLabel: `${animes}/20`,
    },
    {
      key: "critic",
      name: "The Critic",
      description: "Rate 50 titles",
      icon: "star",
      color: "#fbbf24",
      unlocked: rated >= 50,
      progress: Math.min(1, rated / 50),
      progressLabel: `${rated}/50`,
    },
    {
      key: "all_timer",
      name: "All-Timer",
      description: "Give a perfect 10/10",
      icon: "trophy",
      color: "#f59e0b",
      unlocked: hasTen,
      progress: hasTen ? 1 : 0,
      progressLabel: hasTen ? "Achieved" : "Not yet",
    },
    {
      key: "genre_nerd",
      name: "Genre Nerd",
      description: "10+ titles in one genre",
      icon: "drama",
      color: "#a855f7",
      unlocked: maxGenreCount >= 10,
      progress: Math.min(1, maxGenreCount / 10),
      progressLabel: `${maxGenreCount}/10`,
    },
    {
      key: "binge_month",
      name: "Binge Month",
      description: "Watch 10+ titles in one month",
      icon: "flame",
      color: "#ef4444",
      unlocked: bestMonthCount >= 10,
      progress: Math.min(1, bestMonthCount / 10),
      progressLabel: `${bestMonthCount}/10`,
    },
    {
      key: "well_rounded",
      name: "Well-Rounded",
      description: "Watch films, series AND anime",
      icon: "globe",
      color: "#22c55e",
      unlocked: typesWatched === 3,
      progress: typesWatched / 3,
      progressLabel: `${typesWatched}/3 types`,
    },
  ];
}
