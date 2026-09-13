import { describe, expect, it } from "vitest";
import { buildOverlay, courToFlat, flatEpisode, flatToCour, shouldOverlay, tmdbFromFlat } from "./anime-overlay";
import type { AnimeCour } from "../types";

// The coordinate arithmetic under invariant (c) — the lens — had no test of its own: it was only ever
// exercised through `media-view.test.ts`. A module that translates between two coordinate systems is
// exactly where an off-by-one hides for months (a cour's last episode landing in the next cour is the
// kind of bug that shows as "S3 E0"). Real shapes, read out of the live `anime_cours` table.

/** JUJUTSU KAISEN — TMDB: one flat season of 59. AniList: 24 + 23 + 12 (S3 still airing → null end). */
const jjk: AnimeCour[] = [
  { season: 1, anilist_id: 113415, title: "Jujutsu Kaisen", poster_url: null, year: 2020, end_year: 2021, episodes: 24, start_episode: 1, end_episode: 24 },
  { season: 2, anilist_id: 145064, title: "Jujutsu Kaisen 2nd Season", poster_url: null, year: 2023, end_year: 2023, episodes: 23, start_episode: 25, end_episode: 47 },
  { season: 3, anilist_id: 178025, title: "Jujutsu Kaisen: Shimetsu Kaiyuu", poster_url: "https://img.anilist.co/s3.jpg", year: 2026, end_year: null, episodes: null, start_episode: 48, end_episode: null },
];

describe("flatToCour / courToFlat — the two directions agree", () => {
  it("maps the edges of every cour, not just the middle", () => {
    expect(flatToCour(1, jjk)).toEqual({ season: 1, episode: 1 });
    expect(flatToCour(24, jjk)).toEqual({ season: 1, episode: 24 });   // last of S1 stays in S1
    expect(flatToCour(25, jjk)).toEqual({ season: 2, episode: 1 });    // first of S2 is S2 E1
    expect(flatToCour(47, jjk)).toEqual({ season: 2, episode: 23 });
    expect(flatToCour(48, jjk)).toEqual({ season: 3, episode: 1 });    // an airing cour has no end → still matched
  });

  it("flat 0 is 'not started', never S1 E0 of the wrong cour", () => {
    expect(flatToCour(0, jjk)).toEqual({ season: 1, episode: 0 });
    expect(flatToCour(-3, jjk)).toEqual({ season: 1, episode: 0 });
  });

  it("beyond the last known episode, the last cour absorbs the overflow instead of throwing", () => {
    const closed: AnimeCour[] = jjk.slice(0, 2); // S2 ends at 47, nothing after
    expect(flatToCour(60, closed)).toEqual({ season: 2, episode: 36 });
  });

  it("round-trips every episode of a 59-episode show", () => {
    for (let flat = 1; flat <= 59; flat++) {
      const c = flatToCour(flat, jjk);
      expect(courToFlat(c.season, c.episode, jjk)).toBe(flat);
    }
  });

  it("courToFlat on an unknown season falls back to the LAST cour, not the first", () => {
    // Asked for "season 9" of a 3-cour show: the only honest answer is an offset from the end.
    expect(courToFlat(9, 2, jjk)).toBe(49);
  });
});

describe("flatEpisode / tmdbFromFlat — TMDB storage coordinates", () => {
  it("a single flat TMDB season is the identity", () => {
    expect(flatEpisode([59], 1, 47)).toBe(47);
    expect(tmdbFromFlat([59], 47)).toEqual({ season: 1, episode: 47 });
    expect(tmdbFromFlat(null, 12)).toEqual({ season: 1, episode: 12 });
  });

  it("a multi-season TMDB show accumulates the earlier seasons", () => {
    const eps = [10, 12, 8];
    expect(flatEpisode(eps, 1, 10)).toBe(10);
    expect(flatEpisode(eps, 2, 1)).toBe(11);
    expect(flatEpisode(eps, 3, 8)).toBe(30);
    expect(tmdbFromFlat(eps, 10)).toEqual({ season: 1, episode: 10 });  // boundary stays in S1
    expect(tmdbFromFlat(eps, 11)).toEqual({ season: 2, episode: 1 });
    expect(tmdbFromFlat(eps, 30)).toEqual({ season: 3, episode: 8 });
    // Overflow keeps counting in the last season — MONOTONIC. Before 2026-09-13 flat 31 answered
    // S3 E1, the same as flat 23: the loop had subtracted the last season before giving up.
    expect(tmdbFromFlat(eps, 31)).toEqual({ season: 3, episode: 9 });
    expect(tmdbFromFlat(eps, 35)).toEqual({ season: 3, episode: 13 });
  });

  it("a season index past the array does not read undefined as NaN", () => {
    expect(flatEpisode([10, 12], 5, 3)).toBe(25); // offset = 10 + 12, then +3
  });
});

describe("shouldOverlay — the ONE gate", () => {
  const row = { source: "anilist", cours: jjk };
  it("opens only for an anime that TMDB lumps into a single season and AniList resolved cleanly", () => {
    expect(shouldOverlay({ type: "anime", season_episodes: [59] }, row)).toBe(true);
    expect(shouldOverlay({ type: "anime", season_episodes: null }, row)).toBe(true);   // no count = lumped
  });
  it("stays shut for a multi-season TMDB anime — its real seasons must not be re-cut", () => {
    expect(shouldOverlay({ type: "anime", season_episodes: [24, 23, 12] }, row)).toBe(false);
  });
  it("stays shut for a non-anime, a mismatch, a missing row or an empty cours list", () => {
    expect(shouldOverlay({ type: "serie", season_episodes: [59] }, row)).toBe(false);
    expect(shouldOverlay({ type: "anime", season_episodes: [59] }, { source: "mismatch", cours: jjk })).toBe(false);
    expect(shouldOverlay({ type: "anime", season_episodes: [59] }, null)).toBe(false);
    expect(shouldOverlay({ type: "anime", season_episodes: [59] }, { source: "anilist", cours: [] })).toBe(false);
  });
});

describe("buildOverlay — the strip's per-cour arrays", () => {
  it("splits what has AIRED across the cours and caps each at its announced length", () => {
    // 52 episodes aired: S1 full (24), S2 full (23), S3 has 5 of an unannounced count.
    const v = buildOverlay({ season_aired: [52], season_episodes: [59], episodes: 59, current_season: 1, current_episode: 30 }, jjk);
    expect(v.seasonEpisodes).toEqual([24, 23, 5]); // the airing cour's "total" is what has aired so far
    expect(v.seasonAired).toEqual([24, 23, 5]);
    expect(v.currentSeason).toBe(2);
    expect(v.currentEpisode).toBe(6);                // flat 30 = S2 E6
  });

  it("a cour that has not started yet shows 0 aired, never a negative number", () => {
    const v = buildOverlay({ season_aired: [20], season_episodes: [59], episodes: 59, current_season: 1, current_episode: 0 }, jjk);
    expect(v.seasonAired).toEqual([20, 0, 0]);
    expect(v.seasonEpisodes[2]).toBe(0);
  });

  it("floors 'year watched' at the year the cour FINISHED, falling back to its start year", () => {
    const v = buildOverlay({ season_aired: [59], season_episodes: [59], episodes: 59, current_season: 1, current_episode: 0 }, jjk);
    expect(v.seasonEndDates).toEqual(["2021-12-31", "2023-12-31", "2026-12-31"]); // S1 ran 2020→2021
  });

  it("with no season_aired it falls back to the announced count, then to `episodes`", () => {
    expect(buildOverlay({ season_aired: null, season_episodes: [47], episodes: 47, current_season: 1, current_episode: 0 }, jjk).seasonAired).toEqual([24, 23, 0]);
    expect(buildOverlay({ season_aired: null, season_episodes: null, episodes: 30, current_season: 1, current_episode: 0 }, jjk).seasonAired).toEqual([24, 6, 0]);
  });
});
