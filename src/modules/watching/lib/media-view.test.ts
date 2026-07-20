import { describe, expect, it } from "vitest";
import { buildMediaView } from "./media-view";
import { markWatchedPatch, positionPatch, type StatusFacts } from "./watch-status";
import type { AnimeCoursRow, WatchingMedia } from "../types";

// Real rows, read out of the live database on 2026-07-20. Invented cases prove invented things.

/** BLUE LOCK — TMDB lumps it flat (1 season, 38 eps); AniList cuts it S1 = 1-24, S2 = 25-38. */
const blueLockCours: AnimeCoursRow = {
  tmdb_id: 131041,
  source: "anilist",
  cours: [
    { season: 1, anilist_id: 137822, title: "Blue Lock", poster_url: "https://img.anilist.co/s1.jpg", year: 2022, end_year: 2023, episodes: 24, start_episode: 1, end_episode: 24 },
    { season: 2, anilist_id: 168407, title: "Blue Lock S2", poster_url: "https://img.anilist.co/s2.jpg", year: 2024, end_year: 2024, episodes: 14, start_episode: 25, end_episode: 38 },
  ],
};

const blueLock = (over: Partial<WatchingMedia> = {}) =>
  ({
    id: "bl", type: "anime", title: "BLUE LOCK", tmdb_id: 131041,
    season_episodes: [38], season_aired: [38], season_posters: [null], season_end_dates: [null],
    // Flat episode 28 = cour 2, episode 4.
    current_season: 1, current_episode: 28,
    season_years: {}, season_ratings: {},
    cour_years: { "2": 2025 }, cour_ratings: {},
    rating: 8.3, user_rating: null,
    ...over,
  }) as unknown as WatchingMedia;

/** HOUSE OF THE DRAGON — a plain series: display IS storage. */
const hotd = (over: Partial<WatchingMedia> = {}) =>
  ({
    id: "hotd", type: "serie", title: "House of the Dragon", tmdb_id: 94997,
    season_episodes: [10, 8, 8], season_aired: [10, 8, 5],
    season_posters: ["/s1.jpg", "/s2.jpg", "/s3.jpg"],
    season_end_dates: ["2022-10-23", "2024-08-04", null],
    current_season: 3, current_episode: 4,
    season_years: { "1": 2022, "2": 2024 }, season_ratings: { "1": 8, "2": 7.5 },
    cour_years: {}, cour_ratings: {},
    rating: 8.4, user_rating: 7.5,
    ...over,
  }) as unknown as WatchingMedia;

describe("buildMediaView — a plain series: display IS storage", () => {
  const view = buildMediaView(hotd(), null);

  it("does not overlay, and every conversion is the identity", () => {
    expect(view.overlaid).toBe(false);
    expect(view.toStorage(2, 4)).toEqual({ season: 2, episode: 4 });
    expect(view.fromStorage(2, 4)).toEqual({ season: 2, episode: 4 });
  });

  it("reports the position and the seasons unchanged", () => {
    expect(view.position).toEqual({ season: 3, episode: 4 });
    expect(view.seasons).toHaveLength(3);
    expect(view.seasons[2]).toMatchObject({ season: 3, episodes: 8, aired: 5, endDate: null });
  });

  it("reads and writes season_years — never the cour columns", () => {
    expect(view.yearMap).toEqual({ "1": 2022, "2": 2024 });
    expect(view.writeYear(3, 2026)).toEqual({ season_years: { "1": 2022, "2": 2024, "3": 2026 } });
    expect(view.writeRating(3, 9)).toEqual({ season_ratings: { "1": 8, "2": 7.5, "3": 9 } });
  });
});

describe("buildMediaView — an overlaid anime: display is COURS", () => {
  const view = buildMediaView(blueLock(), blueLockCours);

  it("cuts the flat season into its real cours", () => {
    expect(view.overlaid).toBe(true);
    expect(view.seasons).toHaveLength(2);
    expect(view.seasons[0]).toMatchObject({ season: 1, episodes: 24, aired: 24 });
    expect(view.seasons[1]).toMatchObject({ season: 2, episodes: 14, aired: 14 });
    expect(view.seasons[1].poster).toBe("https://img.anilist.co/s2.jpg");
  });

  it("speaks your language: flat episode 28 IS season 2, episode 4", () => {
    expect(view.position).toEqual({ season: 2, episode: 4 });
    expect(view.fromStorage(1, 28)).toEqual({ season: 2, episode: 4 });
    expect(view.toStorage(2, 4)).toEqual({ season: 1, episode: 28 });
  });

  it("round-trips every cour position — the conversion loses nothing", () => {
    for (const [s, e] of [[1, 1], [1, 24], [2, 1], [2, 14]] as const) {
      const stored = view.toStorage(s, e);
      expect(view.fromStorage(stored.season, stored.episode), `S${s}E${e}`).toEqual({ season: s, episode: e });
    }
  });

  it("🔴 THE BUG: a year routes to cour_years, keyed by COUR — not season_years", () => {
    // Every automatic stamp used to write season_years, which for a lumped anime holds ONE entry for
    // the whole show and which the strip never reads. So no year could ever appear on a cour poster.
    expect(view.yearMap).toEqual({ "2": 2025 });
    expect(view.writeYear(1, 2026)).toEqual({ cour_years: { "1": 2026, "2": 2025 } });
    expect(view.writeRating(1, 9)).toEqual({ cour_ratings: { "1": 9 } });
  });

  it("never touches the TMDB-space columns Stats reads", () => {
    const patch = view.writeYear(1, 2026);
    expect("season_years" in patch).toBe(false);
    expect("season_ratings" in view.writeRating(1, 9)).toBe(false);
  });
});

describe("buildMediaView — the fallback is always safe", () => {
  it("refuses to overlay when AniList did not resolve cleanly", () => {
    const view = buildMediaView(blueLock(), { ...blueLockCours, source: "mismatch" });
    expect(view.overlaid).toBe(false);
    expect(view.position).toEqual({ season: 1, episode: 28 });   // flat, as stored
    expect(view.writeYear(1, 2026)).toEqual({ season_years: { "1": 2026 } });
  });

  it("refuses to overlay a series, and survives a missing cours row", () => {
    expect(buildMediaView(hotd(), blueLockCours).overlaid).toBe(false);
    expect(buildMediaView(blueLock(), null).overlaid).toBe(false);
    expect(buildMediaView(blueLock(), undefined).overlaid).toBe(false);
  });

  it("refuses to overlay an anime TMDB already cuts into real seasons", () => {
    // A multi-season TMDB anime has genuine episode coordinates — re-cutting would fight them.
    const view = buildMediaView(blueLock({ season_episodes: [24, 14], season_aired: [24, 14] }), blueLockCours);
    expect(view.overlaid).toBe(false);
  });
});

// ── THE LENS CLOSES THE YEAR BUG ──────────────────────────────────────────────────────────────
// The stamping functions decide "which season did I just finish". In storage space a lumped anime
// has ONE season, so the answer was always "none" and no year could ever be recorded on a cour.

describe("the stamping functions, through the lens", () => {
  const thisYear = new Date().getFullYear();
  /** Standing at the END of cour 1 (flat episode 24 of 38), about to start cour 2. */
  const atCourBoundary = blueLock({ current_season: 1, current_episode: 24, cour_years: {}, status: "ended" });
  const facts = atCourBoundary as unknown as StatusFacts;

  it("🔴 WITHOUT the lens, crossing a cour boundary stamps NOTHING — the bug, reproduced", () => {
    // Flat 24 → 25 is "same TMDB season, one episode further". No boundary is visible, so no year.
    const p = positionPatch(facts, 1, 25, "viewing");
    expect(p.season_years).toBeUndefined();
    expect("cour_years" in p).toBe(false);
  });

  it("✅ WITH the lens, the same move dates the cour you just finished — in cour_years", () => {
    const view = buildMediaView(atCourBoundary, blueLockCours);
    const p = positionPatch(facts, 1, 25, "viewing", view);
    expect(p.cour_years).toEqual({ "1": thisYear });
    // And it must never touch the TMDB-space column Stats reads.
    expect("season_years" in p).toBe(false);
    // The position itself is still written in STORAGE coordinates.
    expect(p.current_season).toBe(1);
    expect(p.current_episode).toBe(25);
  });

  it("a CORRECTION across the same boundary still stamps nothing", () => {
    const view = buildMediaView(atCourBoundary, blueLockCours);
    const p = positionPatch(facts, 1, 25, "correction", view);
    expect("cour_years" in p).toBe(false);
  });

  it("mid-cour progress stamps nothing — the cour is not over", () => {
    const view = buildMediaView(atCourBoundary, blueLockCours);
    const p = positionPatch(facts, 1, 10, "viewing", view);
    expect("cour_years" in p).toBe(false);
  });

  it("markWatchedPatch dates EVERY finished cour, in cour_years", () => {
    const view = buildMediaView(atCourBoundary, blueLockCours);
    const p = markWatchedPatch(facts, view);
    expect(p.cour_years).toEqual({ "1": thisYear, "2": thisYear });
    expect("season_years" in p).toBe(false);
    // Position still lands at the last aired episode in storage space.
    expect(p.current_episode).toBe(38);
  });

  it("a plain series is completely unaffected by passing its (identity) lens", () => {
    const withoutLens = positionPatch(hotd() as unknown as StatusFacts, 3, 5, "viewing");
    const withLens = positionPatch(hotd() as unknown as StatusFacts, 3, 5, "viewing", buildMediaView(hotd(), null));
    expect(withLens.season_years).toEqual(withoutLens.season_years);
    expect(withLens.current_episode).toBe(withoutLens.current_episode);
  });
});
