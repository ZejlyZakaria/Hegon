import type { JournalEntry, JournalMood } from "../types";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MOODS: JournalMood[] = ["calm", "good", "neutral", "tired", "rough"];

export interface JournalStats {
  totalEntries: number;
  totalWords: number;
  activeDays: number;
  avgWords: number;
  moodDistribution: { mood: JournalMood; count: number }[];
  monthly: { label: string; count: number }[];
  topTags: { name: string; count: number }[];
}

export function computeJournalStats(entries: JournalEntry[]): JournalStats {
  const totalEntries = entries.length;
  const totalWords = entries.reduce((s, e) => s + (e.word_count ?? 0), 0);
  const activeDays = new Set(entries.map((e) => e.entry_date)).size;
  const avgWords = totalEntries > 0 ? Math.round(totalWords / totalEntries) : 0;

  const moodCounts = new Map<JournalMood, number>();
  for (const e of entries) {
    if (e.mood) moodCounts.set(e.mood, (moodCounts.get(e.mood) ?? 0) + 1);
  }
  const moodDistribution = MOODS.map((m) => ({ mood: m, count: moodCounts.get(m) ?? 0 }));

  // Entries per month, current year (string-slice dates → anti-TZ).
  const year = String(new Date().getFullYear());
  const monthCounts = new Array(12).fill(0);
  for (const e of entries) {
    if (e.entry_date.slice(0, 4) === year) {
      monthCounts[Number(e.entry_date.slice(5, 7)) - 1]++;
    }
  }
  const monthly = monthCounts.map((c, i) => ({ label: MONTHS[i], count: c }));

  const tagCounts = new Map<string, number>();
  for (const e of entries) {
    for (const t of e.tags ?? []) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
  }
  const topTags = [...tagCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  return { totalEntries, totalWords, activeDays, avgWords, moodDistribution, monthly, topTags };
}
