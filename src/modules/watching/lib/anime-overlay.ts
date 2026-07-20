// =====================================================
// ANIME V2 — the AniList season overlay, in ONE place (pure, testable).
// =====================================================
//
// TMDB lumps an anime into a single flat season (Jujutsu Kaisen = "S1, 59 episodes"). AniList knows
// the real seasons (24 + 23 + 12). This module translates between the two coordinate systems:
//
//   · STORAGE stays in TMDB coordinates — `current_season` / `current_episode`, episode marks, stats.
//     Nothing about your tracking moves; ep 47 is still ep 47 in the database.
//   · DISPLAY is in COUR coordinates — "you're on Season 2, episode 23".
//
// The overlay is a lens, not a migration. It is applied ONLY when a title is safe to re-cut, and the
// UI always falls back to TMDB's flat structure otherwise. So an anime can never end up broken: the
// worst case is it looks exactly like it does today.

import type { WatchingMedia, AnimeCour } from "../types";

/**
 * May we apply the season overlay to this anime? Only when ALL hold:
 *   · it's an anime,
 *   · AniList resolved it cleanly (source 'anilist' — never 'mismatch'/'none'),
 *   · TMDB lumps it into a SINGLE flat season. A multi-season TMDB anime already has real seasons,
 *     and re-cutting it would fight TMDB's own episode coordinates — so we leave it alone. (This is
 *     exactly the set of "lumped" anime the feature exists to fix: JJK, Blue Lock, AoT…)
 */
export function shouldOverlay(
  media: Pick<WatchingMedia, "type" | "season_episodes">,
  row: { source: string; cours: AnimeCour[] } | null | undefined,
): row is { source: "anilist"; cours: AnimeCour[] } {
  if (!row || row.source !== "anilist" || row.cours.length === 0) return false;
  if (media.type !== "anime") return false;
  return (media.season_episodes?.length ?? 1) <= 1;
}

/** Flat episode index (1-based, across the whole show) from a stored TMDB position. For the single-
 *  season anime we overlay this is just `episode`; the cumulative form keeps it correct regardless. */
export function flatEpisode(seasonEpisodes: number[] | null | undefined, season: number, episode: number): number {
  const eps = seasonEpisodes ?? [];
  let offset = 0;
  for (let i = 0; i < season - 1 && i < eps.length; i++) offset += eps[i] ?? 0;
  return offset + episode;
}

/** TMDB (season, episode) for a flat episode index — the inverse. Storage stays in TMDB coordinates. */
export function tmdbFromFlat(seasonEpisodes: number[] | null | undefined, flat: number): { season: number; episode: number } {
  const eps = seasonEpisodes ?? [];
  if (eps.length <= 1) return { season: 1, episode: flat };
  let remaining = flat;
  for (let i = 0; i < eps.length; i++) {
    const n = eps[i] ?? 0;
    if (remaining <= n) return { season: i + 1, episode: remaining };
    remaining -= n;
  }
  return { season: eps.length, episode: remaining };
}

/** Which cour a flat episode sits in, and the episode number WITHIN that cour. `flat = 0` = not started. */
export function flatToCour(flat: number, cours: AnimeCour[]): { season: number; episode: number } {
  if (flat <= 0) return { season: 1, episode: 0 };
  for (const c of cours) {
    const end = c.end_episode ?? Number.POSITIVE_INFINITY;
    if (flat >= c.start_episode && flat <= end) return { season: c.season, episode: flat - c.start_episode + 1 };
  }
  const last = cours[cours.length - 1];
  return { season: last.season, episode: Math.max(0, flat - last.start_episode + 1) };
}

/** The flat episode index for a cour position (season index + episode within that cour). */
export function courToFlat(season: number, episode: number, cours: AnimeCour[]): number {
  const c = cours.find((x) => x.season === season) ?? cours[cours.length - 1];
  return c.start_episode + episode - 1;
}

/** The per-season arrays the Watch History strip wants — cut by cour, not by TMDB season — plus the
 *  current position remapped into cour coordinates. Everything here is DISPLAY; storage is untouched. */
export interface OverlayView {
  seasonEpisodes: number[];
  seasonAired: number[];
  seasonPosters: (string | null)[];   // absolute AniList URLs
  seasonEndDates: (string | null)[];  // synthesised from the cour year → floors the year picker
  currentSeason: number;
  currentEpisode: number;
  cours: AnimeCour[];
}

/** Only what the overlay actually reads — so a card selecting a subset of columns can build one. */
export type OverlaySource = Pick<
  WatchingMedia,
  "season_aired" | "season_episodes" | "episodes" | "current_season" | "current_episode"
>;

export function buildOverlay(media: OverlaySource, cours: AnimeCour[]): OverlayView {
  // Episodes ACTUALLY AIRED across the whole show (TMDB truth), used to split aired-per-cour.
  const flatAired =
    (media.season_aired ?? media.season_episodes ?? []).reduce((a, b) => a + (b ?? 0), 0) ||
    (media.episodes ?? 0);

  const seasonEpisodes: number[] = [];
  const seasonAired: number[] = [];
  const seasonPosters: (string | null)[] = [];
  const seasonEndDates: (string | null)[] = [];

  for (const c of cours) {
    const offset = c.start_episode - 1;
    // A still-airing cour has no announced count → use however much has aired.
    const full = c.episodes ?? Math.max(0, flatAired - offset);
    const aired = Math.max(0, Math.min(flatAired - offset, full));
    seasonEpisodes.push(full);
    seasonAired.push(aired);
    seasonPosters.push(c.poster_url);
    // Floor "year watched" at the year the cour FINISHED airing, not the year it started — a cour
    // that ran Oct→Mar could not have been finished the year before. Falls back to the start year.
    const floorYear = c.end_year ?? c.year;
    seasonEndDates.push(floorYear ? `${floorYear}-12-31` : null);
  }

  const flat = flatEpisode(media.season_episodes, media.current_season ?? 1, media.current_episode ?? 0);
  const pos = flatToCour(flat, cours);

  return {
    seasonEpisodes,
    seasonAired,
    seasonPosters,
    seasonEndDates,
    currentSeason: pos.season,
    currentEpisode: pos.episode,
    cours,
  };
}
