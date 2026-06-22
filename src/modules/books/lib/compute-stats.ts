import type { Book, ReadingLogRow } from "../types";
import type { Achievement } from "@/shared/components/achievements/types";

export interface BookComputedStats {
  availableYears:    number[];
  read:              number;          // books read in the selected period
  pagesRead:         number;          // Σ total_pages of those books
  avgRating:         number | null;
  ratedCount:        number;
  avgPages:          number | null;   // typical book length
  favorites:         number;          // all-time (favorite isn't period-bound)
  topGenres:         { name: string; count: number }[];
  topAuthors:        { name: string; count: number }[];
  ratingDistribution:{ score: number; count: number }[]; // 1–5
  topRated:          Book[];          // top 3 (favorite first, then rating)
  activity:          { label: string; count: number }[]; // monthly (year) or yearly (all-time)
  bestMonth:         { label: string; count: number } | null;
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const readWith = (books: Book[]) => books.filter((b) => b.status === "read" && b.finished_at);

export function computeBookStats(
  books: Book[],
  year: number | null,
  logRows: ReadingLogRow[] = [],
): BookComputedStats {
  const allRead = readWith(books);
  const filtered = year
    ? allRead.filter((b) => new Date(b.finished_at!).getFullYear() === year)
    : allRead;

  // The reading log is passed ALL-TIME; scope it to the selected year here (or keep
  // all). Pages read + activity come from the log — actual pages turned, in-progress
  // books included — not finished-book counts. (date is "YYYY-MM-DD" → string slice
  // avoids any timezone drift.)
  const scopedLog = year ? logRows.filter((r) => Number(r.date.slice(0, 4)) === year) : logRows;
  const pagesRead = scopedLog.reduce((s, r) => s + (r.pages_read ?? 0), 0);

  const rated = filtered.filter((b) => b.rating != null);
  const avgRating = rated.length > 0
    ? Math.round((rated.reduce((s, b) => s + (b.rating ?? 0), 0) / rated.length) * 10) / 10
    : null;

  const withPages = filtered.filter((b) => b.total_pages);
  const avgPages = withPages.length > 0
    ? Math.round(withPages.reduce((s, b) => s + (b.total_pages ?? 0), 0) / withPages.length)
    : null;

  // Genres
  const genreCount: Record<string, number> = {};
  for (const b of filtered) for (const g of b.genre ?? []) genreCount[g] = (genreCount[g] ?? 0) + 1;
  const topGenres = Object.entries(genreCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6)
    .map(([name, count]) => ({ name, count }));

  // Authors
  const authorCount: Record<string, number> = {};
  for (const b of filtered) if (b.author) authorCount[b.author] = (authorCount[b.author] ?? 0) + 1;
  const topAuthors = Object.entries(authorCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  // Rating distribution (1–5)
  const dist: Record<number, number> = {};
  for (const b of rated) {
    const bucket = Math.round(b.rating ?? 0);
    if (bucket >= 1 && bucket <= 5) dist[bucket] = (dist[bucket] ?? 0) + 1;
  }
  const ratingDistribution = Array.from({ length: 5 }, (_, i) => ({ score: i + 1, count: dist[i + 1] ?? 0 }));

  // Top rated (favorite first, then rating)
  const topRated = [...filtered]
    .filter((b) => b.favorite || (b.rating ?? 0) >= 4)
    .sort((a, b) => {
      if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
      return (b.rating ?? 0) - (a.rating ?? 0);
    })
    .slice(0, 3);

  // Activity — pages read per month (within a year) or per year (all-time), from the
  // log → it reflects active reading, not just finished books.
  let activity: { label: string; count: number }[];
  if (year) {
    const counts12 = new Array(12).fill(0);
    for (const r of scopedLog) counts12[Number(r.date.slice(5, 7)) - 1] += r.pages_read ?? 0;
    activity = MONTHS.map((label, i) => ({ label, count: counts12[i] }));
  } else {
    const yearCounts: Record<number, number> = {};
    for (const r of scopedLog) {
      const y = Number(r.date.slice(0, 4));
      yearCounts[y] = (yearCounts[y] ?? 0) + (r.pages_read ?? 0);
    }
    activity = Object.keys(yearCounts).map(Number).sort((a, b) => a - b)
      .map((y) => ({ label: String(y), count: yearCounts[y] }));
  }

  // Best month — by pages read (within the current scope).
  const monthCounts: Record<string, number> = {};
  for (const r of scopedLog) {
    const key = `${MONTHS[Number(r.date.slice(5, 7)) - 1]} ${r.date.slice(0, 4)}`;
    monthCounts[key] = (monthCounts[key] ?? 0) + (r.pages_read ?? 0);
  }
  const monthEntries = Object.entries(monthCounts).sort(([, a], [, b]) => b - a);
  const bestMonth = monthEntries[0] ? { label: monthEntries[0][0], count: monthEntries[0][1] } : null;

  // Years that have either a finished book OR logged reading (so a year you read in
  // but haven't finished a book still gets a pill).
  const availableYears = [
    ...new Set([
      ...allRead.map((b) => new Date(b.finished_at!).getFullYear()),
      ...logRows.map((r) => Number(r.date.slice(0, 4))),
    ]),
  ].sort((a, b) => b - a);

  return {
    availableYears,
    read: filtered.length,
    pagesRead,
    avgRating,
    ratedCount: rated.length,
    avgPages,
    favorites: books.filter((b) => b.favorite).length,
    topGenres,
    topAuthors,
    ratingDistribution,
    topRated,
    activity,
    bestMonth,
  };
}

// Achievements — all-time (ignore the year filter), mirror of the watching set.
export function computeBookAchievements(books: Book[], logRows: ReadingLogRow[] = []): Achievement[] {
  const read       = books.filter((b) => b.status === "read");
  const readCount  = read.length;
  // Pages turned come from the reading log (in-progress books count too), not Σ
  // total_pages of finished books — so "Page Turner" tracks actual reading.
  const pagesTotal = logRows.reduce((s, r) => s + (r.pages_read ?? 0), 0);
  const ratedCount = read.filter((b) => b.rating != null).length;
  const hasFive    = read.some((b) => (b.rating ?? 0) >= 5);
  const longest    = Math.max(0, ...read.map((b) => b.total_pages ?? 0));

  const genreCount: Record<string, number> = {};
  for (const b of read) for (const g of b.genre ?? []) genreCount[g] = (genreCount[g] ?? 0) + 1;
  const maxGenre = Math.max(0, ...Object.values(genreCount));

  const authorCount: Record<string, number> = {};
  for (const b of read) if (b.author) authorCount[b.author] = (authorCount[b.author] ?? 0) + 1;
  const maxAuthor = Math.max(0, ...Object.values(authorCount));

  const accent = "var(--color-accent-books-vivid)";

  return [
    {
      key: "bookworm", name: "Bookworm", description: "Read 25 books", icon: "layers",
      color: accent, unlocked: readCount >= 25, progress: Math.min(1, readCount / 25), progressLabel: `${readCount}/25`,
    },
    {
      key: "bibliophile", name: "Bibliophile", description: "Read 100 books", icon: "gem",
      color: "#a855f7", unlocked: readCount >= 100, progress: Math.min(1, readCount / 100), progressLabel: `${readCount}/100`,
    },
    {
      key: "page_turner", name: "Page Turner", description: "Read 10,000 pages", icon: "flame",
      color: "#ef4444", unlocked: pagesTotal >= 10000, progress: Math.min(1, pagesTotal / 10000), progressLabel: `${pagesTotal.toLocaleString()}/10,000`,
    },
    {
      key: "critic", name: "The Critic", description: "Rate 25 books", icon: "star",
      color: "#fbbf24", unlocked: ratedCount >= 25, progress: Math.min(1, ratedCount / 25), progressLabel: `${ratedCount}/25`,
    },
    {
      key: "masterpiece", name: "Masterpiece", description: "Give a perfect 5/5", icon: "trophy",
      color: "#f59e0b", unlocked: hasFive, progress: hasFive ? 1 : 0, progressLabel: hasFive ? "Achieved" : "Not yet",
    },
    {
      key: "genre_devotee", name: "Genre Devotee", description: "5+ books in one genre", icon: "drama",
      color: "#22c55e", unlocked: maxGenre >= 5, progress: Math.min(1, maxGenre / 5), progressLabel: `${maxGenre}/5`,
    },
    {
      key: "loyal_reader", name: "Loyal Reader", description: "3+ books by one author", icon: "medal",
      color: "#818cf8", unlocked: maxAuthor >= 3, progress: Math.min(1, maxAuthor / 3), progressLabel: `${maxAuthor}/3`,
    },
    {
      key: "tome_slayer", name: "Tome Slayer", description: "Finish a 600+ page book", icon: "globe",
      color: "#0ea5e9", unlocked: longest >= 600, progress: Math.min(1, longest / 600), progressLabel: longest >= 600 ? "Achieved" : `${longest}/600`,
    },
  ];
}
