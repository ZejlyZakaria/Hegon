import { airedCount, watchedCount, type SeriesFacts } from "./series-state";

// ⛔ `nextEpisode` used to live here and reasoned from `season_episodes` — the ANNOUNCED
// episode counts. That let the app offer you a "+1" into an episode that hasn't aired. It's
// gone; the real thing is `nextStep` in series-state.ts, which reads `season_aired`.
// ⛔ `episodesLeftInSeason` is gone too: nothing imported it, and it counted the announced.

/** "S03 E04" — zero-padded so a column of them lines up. */
export function formatPosition(season: number, episode: number): string {
  return `S${String(season).padStart(2, "0")} E${String(episode).padStart(2, "0")}`;
}

/**
 * The carousel's progress bar: how far through WHAT EXISTS you are.
 *
 * It used to measure against the ANNOUNCED total, which put a card in the absurd position of
 * showing a bar stalled at 81% directly beside the "Caught up" badge its own "+1" button had
 * drawn — two claims about the same show, three centimetres apart, contradicting each other.
 * You are 100% through what has aired. That the story isn't over is what the badge is for.
 */
export function overallProgress(media: SeriesFacts): number {
  const aired = airedCount(media);
  if (!aired) return 0;
  return Math.round((watchedCount(media) / aired) * 100);
}
