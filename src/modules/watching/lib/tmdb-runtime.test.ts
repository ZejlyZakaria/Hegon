import { describe, it, expect } from "vitest";
import { runtimeFromTmdb } from "./tmdb-runtime";

/**
 * The shapes below are REAL payloads, trimmed — measured against the live TMDB API on 2026-07-25.
 * They exist so the day `episode_run_time` comes back to life (or dies further), this file is what
 * tells us, instead of a stats page quietly printing a smaller number.
 */
describe("runtimeFromTmdb — a film is its own length", () => {
  it("reads the film's runtime", () => {
    expect(runtimeFromTmdb({ runtime: 148 }, true)).toBe(148);
  });

  it("never borrows a series field for a film", () => {
    expect(runtimeFromTmdb({ runtime: null, last_episode_to_air: { runtime: 57 } }, true)).toBeNull();
  });
});

/**
 * MEASURED BEATS DECLARED, AND A MEDIAN BEATS ONE SAMPLE.
 *
 * These numbers are real, taken from the live API on 2026-07-25. `last_episode_to_air` is a single
 * reading taken at the worst moment — the newest episode is very often a double-length finale — and
 * it was the fallback for exactly one day before the breakdown panel exposed what it was doing.
 */
describe("runtimeFromTmdb — the median of real episodes wins", () => {
  const season = (...runtimes: number[]) => ({ episodes: runtimes.map((runtime) => ({ runtime })) });

  it("prefers the season's median over a double-length finale (Demon Slayer: 41 → 24)", () => {
    expect(runtimeFromTmdb(
      { episode_run_time: [], last_episode_to_air: { runtime: 41 }, "season/1": season(24, 23, 24, 25, 24, 41) },
      false,
    )).toBe(24);
  });

  it("beats the announced length too — a declaration is not a measurement", () => {
    expect(runtimeFromTmdb({ episode_run_time: [60], "season/1": season(48, 47, 49) }, false)).toBe(48);
  });

  it("needs three samples: a median of one or two is just a sample with a longer name", () => {
    expect(runtimeFromTmdb(
      { episode_run_time: [], last_episode_to_air: { runtime: 41 }, "season/1": season(90, 88) },
      false,
    )).toBe(41);
  });

  it("ignores episodes TMDB has no runtime for", () => {
    expect(runtimeFromTmdb({ "season/1": season(24, 0, 24, 0, 25) }, false)).toBe(24);
  });
});

describe("runtimeFromTmdb — a series, where the announced length is usually gone", () => {
  it("uses the announced length when TMDB still has one (One Piece)", () => {
    expect(runtimeFromTmdb({ episode_run_time: [24], last_episode_to_air: { runtime: 45 } }, false)).toBe(24);
  });

  it("averages several announced lengths rather than trusting the first", () => {
    expect(runtimeFromTmdb({ episode_run_time: [20, 30] }, false)).toBe(25);
  });

  /**
   * THE CASE THAT WAS BROKEN. `[]` is what TMDB returns for every modern series; the mapper behind
   * discover stopped here and wrote null, so the title was worth 0 hours forever.
   */
  it("falls back to the last aired episode when the announced list is empty (Elite)", () => {
    expect(runtimeFromTmdb({ episode_run_time: [], last_episode_to_air: { runtime: 57 } }, false)).toBe(57);
  });

  it("falls back when the field is absent altogether", () => {
    expect(runtimeFromTmdb({ last_episode_to_air: { runtime: 64 } }, false)).toBe(64);
  });

  it("ignores a zero-filled announced list instead of billing zero-minute episodes", () => {
    expect(runtimeFromTmdb({ episode_run_time: [0], last_episode_to_air: { runtime: 23 } }, false)).toBe(23);
  });

  /** Blue Lock: nothing announced, nothing aired. Unknown must stay unknown, never 0. */
  it("returns null — not 0 — when neither source knows", () => {
    expect(runtimeFromTmdb({ episode_run_time: [] }, false)).toBeNull();
    expect(runtimeFromTmdb({ episode_run_time: [], last_episode_to_air: null }, false)).toBeNull();
  });

  it("survives a missing payload", () => {
    expect(runtimeFromTmdb(null, false)).toBeNull();
    expect(runtimeFromTmdb(undefined, true)).toBeNull();
  });
});
