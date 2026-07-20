/**
 * THE LENS — the one place that knows which coordinate space a title lives in.
 *
 * Most titles store what they display: "season 2, episode 4" is season 2, episode 4. But TMDB lumps
 * many anime into ONE flat season (Blue Lock = "S1, 38 episodes") while AniList knows the real cours
 * (S1 = ep 1-24, S2 = ep 25-38). So for those titles there are two languages:
 *
 *   · STORAGE  — TMDB coordinates. `current_season`/`current_episode`, episode marks, Stats.
 *   · DISPLAY  — cour coordinates. What you say out loud: "I'm on season 2, episode 4."
 *
 * `anime-overlay.ts` already translated POSITIONS between the two, purely and safely. What it never
 * covered — and what let the bug survive — is that the YEAR and RATING maps are keyed in different
 * spaces too, in different COLUMNS:
 *
 *   season_years / season_ratings  → keyed by TMDB season   (a lumped anime has exactly ONE)
 *   cour_years   / cour_ratings    → keyed by cour          (what the strip actually displays)
 *
 * Nothing routed between them. Every automatic stamp wrote `season_years`; the strip only ever read
 * `cour_years`. So on an overlaid anime the app could not remember which year you watched a season —
 * only a manual edit could write a year, and it could never be corrected. That is the whole bug.
 *
 * A MediaView answers both questions in one object, and — crucially — it is the ONLY sanctioned way
 * to convert. Reads (`position`, `seasons`, `yearMap`) come out in DISPLAY space; writes go back in
 * through `toStorage`/`writeYear`/`writeRating`, which route to the right column automatically. A
 * surface that consumes a view cannot forget the overlay, because it never sees the raw columns.
 *
 * Pure: built from a row plus its cours, no I/O, no React. `watch-status.ts` may import this; this
 * must never import `watch-status.ts`.
 */

import { buildOverlay, courToFlat, flatEpisode, flatToCour, shouldOverlay, tmdbFromFlat } from "./anime-overlay";
import type { SeriesFacts } from "./series-state";
import type { UpdateMediaInput } from "../schemas/media.schema";
import type { AnimeCour, AnimeCoursRow, WatchingMedia } from "../types";

/** One season as the user sees it — a TMDB season normally, a cour under the overlay. */
export interface ViewSeason {
  /** 1-based, in DISPLAY space. */
  season: number;
  /** Announced episodes. */
  episodes: number;
  /** Episodes that have actually AIRED — the only source for progress decisions. */
  aired: number;
  /** Absolute URL (AniList cour) or a TMDB path fragment (plain season). */
  poster: string | null;
  /** When the season finished airing — floors the year picker. */
  endDate: string | null;
}

/**
 * Everything the lens reads. Deliberately a Pick and not `WatchingMedia`: poster cards and list rows
 * select a subset of columns, and they must be able to build a view too — otherwise the surfaces
 * most likely to forget the overlay are exactly the ones locked out of the thing that prevents it.
 */
export type MediaViewSource = Pick<
  WatchingMedia,
  | "type" | "status" | "caught_up_at" | "episodes"
  | "season_episodes" | "season_aired" | "season_posters" | "season_end_dates"
  | "current_season" | "current_episode"
  | "season_years" | "season_ratings" | "cour_years" | "cour_ratings"
>;

export interface MediaView {
  /** The raw row, in STORAGE coordinates — for the pure libs that still reason on it. */
  media: MediaViewSource;
  overlaid: boolean;
  /**
   * WE DO NOT KNOW YET — and that is not the same fact as "no overlay".
   *
   * The cours arrive asynchronously. While they are in flight `shouldOverlay` answers "no" and the
   * lens falls back to the identity, so a lumped anime printed its FLAT position ("S01 E59") and
   * then corrected itself to "S03 E12" a moment later. The user watched the app change its mind.
   *
   * That is the module's signature bug, rebuilt inside the thing meant to cure it: one word standing
   * for two different facts. So "unknown" gets its own flag, and the rule that follows is the same
   * one we apply to years — DO NOT SHOW A CLAIM YOU MAY HAVE TO WITHDRAW. A surface renders no
   * position at all until this is false. Never true for a non-anime: its lens is resolved at birth.
   */
  pending: boolean;
  cours: AnimeCour[] | null;
  /** Where you stand, in DISPLAY space. */
  position: { season: number; episode: number };
  /** The seasons, in DISPLAY space. */
  seasons: ViewSeason[];
  /** The year map for THIS space — `cour_years` when overlaid, `season_years` otherwise. */
  yearMap: Record<string, number> | null;
  ratingMap: Record<string, number> | null;
  /**
   * The world's facts, expressed in DISPLAY space — feed the season-boundary helpers
   * (`isSeasonComplete`, `isSeasonDatable`, `hasReachedSeason`) with THIS, not the raw row.
   *
   * Status is deliberately NOT in here: "how much have I seen vs what has aired" sums to the same
   * number in either space, so `seriesState`/`caughtUpAt` are space-invariant and keep reading the
   * raw row. Only SEASON BOUNDARIES differ — a lumped anime has one flat season and two cours — and
   * that is exactly what decides which season you just finished, hence which year gets stamped.
   */
  seriesFacts: SeriesFacts;
  /** DISPLAY → STORAGE. The only sanctioned way to turn what you said into what we write. */
  toStorage(season: number, episode: number): { season: number; episode: number };
  /** STORAGE → DISPLAY. */
  fromStorage(season: number, episode: number): { season: number; episode: number };
  /** A year for one season, merged into the RIGHT column. This is what closes the bug. */
  writeYear(season: number, year: number): Partial<UpdateMediaInput>;
  /** A whole year map at once ("Set all year"), into the right column. */
  writeYears(next: Record<string, number>): Partial<UpdateMediaInput>;
  /** A rating for one season — `null` clears it. */
  writeRating(season: number, value: number | null): Partial<UpdateMediaInput>;
}

const withKey = (
  map: Record<string, number> | null | undefined,
  season: number,
  value: number | null,
): Record<string, number> => {
  const next = { ...(map ?? {}) };
  if (value == null) delete next[String(season)];
  else next[String(season)] = value;
  return next;
};

export function buildMediaView(
  media: MediaViewSource,
  coursRow: AnimeCoursRow | null | undefined,
  /** True while this title's cours are still in flight — see `MediaView.pending`. */
  pending = false,
): MediaView {
  // `shouldOverlay` is the ONE gate: anime + cleanly resolved by AniList + TMDB lumps it flat.
  // Anything else falls back to storage-is-display, so a title can never end up broken — the worst
  // case is it behaves exactly as it does today.
  if (shouldOverlay(media, coursRow)) {
    const cours = coursRow.cours;
    const ov = buildOverlay(media, cours);
    const seasons: ViewSeason[] = ov.seasonEpisodes.map((episodes, i) => ({
      season: i + 1,
      episodes,
      aired: ov.seasonAired[i] ?? 0,
      poster: ov.seasonPosters[i] ?? null,
      endDate: ov.seasonEndDates[i] ?? null,
    }));

    return {
      media,
      overlaid: true,
      pending: false,
      cours,
      position: { season: ov.currentSeason, episode: ov.currentEpisode },
      seasons,
      yearMap: media.cour_years ?? null,
      ratingMap: media.cour_ratings ?? null,
      seriesFacts: {
        season_episodes: seasons.map((s) => s.episodes),
        season_aired: seasons.map((s) => s.aired),
        status: media.status,
        caught_up_at: media.caught_up_at,
        current_season: ov.currentSeason,
        current_episode: ov.currentEpisode,
      },
      toStorage: (season, episode) =>
        tmdbFromFlat(media.season_episodes, courToFlat(season, episode, cours)),
      fromStorage: (season, episode) =>
        flatToCour(flatEpisode(media.season_episodes, season, episode), cours),
      writeYear: (season, year) => ({ cour_years: withKey(media.cour_years, season, year) }),
      writeYears: (next) => ({ cour_years: next }),
      writeRating: (season, value) => ({ cour_ratings: withKey(media.cour_ratings, season, value) }),
    };
  }

  // No overlay — display IS storage, and every conversion is the identity.
  const announced = media.season_episodes ?? [];
  const seasons: ViewSeason[] = announced.map((episodes, i) => ({
    season: i + 1,
    episodes: episodes ?? 0,
    aired: (media.season_aired ?? [])[i] ?? 0,
    poster: (media.season_posters ?? [])[i] ?? null,
    endDate: (media.season_end_dates ?? [])[i] ?? null,
  }));
  const identity = (season: number, episode: number) => ({ season, episode });

  return {
    media,
    overlaid: false,
    pending,
    cours: null,
    position: { season: media.current_season ?? 1, episode: media.current_episode ?? 0 },
    seasons,
    yearMap: media.season_years ?? null,
    ratingMap: media.season_ratings ?? null,
    seriesFacts: {
      season_episodes: media.season_episodes ?? null,
      season_aired: media.season_aired ?? null,
      status: media.status,
      caught_up_at: media.caught_up_at,
      current_season: media.current_season ?? 1,
      current_episode: media.current_episode ?? 0,
    },
    toStorage: identity,
    fromStorage: identity,
    writeYear: (season, year) => ({ season_years: withKey(media.season_years, season, year) }),
    writeYears: (next) => ({ season_years: next }),
    writeRating: (season, value) => ({ season_ratings: withKey(media.season_ratings, season, value) }),
  };
}
