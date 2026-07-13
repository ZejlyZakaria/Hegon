import type { WatchingMedia } from "../types";

// ⛔ `nextEpisode` used to live here and reasoned from `season_episodes` — the ANNOUNCED
// episode counts. That let the app offer you a "+1" into an episode that hasn't aired. It's
// gone; the real thing is `nextStep` in series-state.ts, which reads `season_aired`.

/** "S03 E04" — zero-padded so a column of them lines up. */
export function formatPosition(season: number, episode: number): string {
  return `S${String(season).padStart(2, "0")} E${String(episode).padStart(2, "0")}`;
}

/** How many episodes are left in the season you're in (null when we can't know). */
export function episodesLeftInSeason(media: {
  season_episodes?: number[] | null;
  current_season?: number | null;
  current_episode?: number | null;
}): number | null {
  const counts = media.season_episodes ?? [];
  const season = media.current_season ?? 1;
  const inThisSeason = counts[season - 1];
  if (inThisSeason == null) return null;
  return Math.max(0, inThisSeason - (media.current_episode ?? 0));
}

// Kept for the carousel's progress bar: fraction of the whole show you've been through.
export function overallProgress(media: Pick<WatchingMedia, "season_episodes" | "current_season" | "current_episode">): number {
  const counts = media.season_episodes ?? [];
  if (!counts.length) return 0;
  const seasonIdx = (media.current_season ?? 1) - 1;
  const before = counts.slice(0, seasonIdx).reduce((s, n) => s + n, 0);
  const total = counts.reduce((s, n) => s + n, 0);
  return total ? Math.round(((before + (media.current_episode ?? 0)) / total) * 100) : 0;
}
