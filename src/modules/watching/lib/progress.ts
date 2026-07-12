import type { WatchingMedia } from "../types";

/**
 * Where "one more episode" takes you.
 *
 * This is the most frequent gesture in the whole product — "I finished an episode" — and until
 * now it cost four or five taps: open the home, find the card, open the detail page, find the
 * stepper. The card already KNEW you were on S03 E03. It just wouldn't let you say so.
 *
 * Pure on purpose: rolling over a season boundary is arithmetic with three edge cases, and
 * arithmetic belongs somewhere it can be tested, not inside a click handler.
 */
export type NextStep =
  | { kind: "episode"; season: number; episode: number }        // next episode, same season
  | { kind: "season"; season: number; episode: number }         // rolled into the next season
  | { kind: "finale" }                                          // last episode of the last season
  | null;                                                       // no episode data → can't know

export function nextEpisode(media: {
  season_episodes?: number[] | null;
  current_season?: number | null;
  current_episode?: number | null;
}): NextStep {
  const counts = media.season_episodes ?? [];
  if (counts.length === 0) return null;

  const season = media.current_season ?? 1;
  const episode = media.current_episode ?? 0;

  // A season number past the data we hold: we can't reason, so we don't guess.
  const inThisSeason = counts[season - 1];
  if (inThisSeason == null) return null;

  if (episode < inThisSeason) {
    return { kind: "episode", season, episode: episode + 1 };
  }

  // Finished this season. Is there another one?
  const nextSeasonCount = counts[season];
  if (nextSeasonCount != null && nextSeasonCount > 0) {
    return { kind: "season", season: season + 1, episode: 1 };
  }

  // Last episode of the last season. Finishing a SHOW is not the same gesture as finishing an
  // episode — it stamps every season's year, ripples into Goals and Habits, and deserves the
  // rating you're about to have opinions about. That flow lives on the detail page and it is
  // NOT re-implemented on a card: status logic has already cost this module five audited bugs.
  return { kind: "finale" };
}

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
