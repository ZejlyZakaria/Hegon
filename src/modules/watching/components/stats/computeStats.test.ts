import { describe, it, expect } from "vitest";
import { computeStats } from "./computeStats";
import type { StatsRawItem, RewatchStatItem } from "../../service";

/**
 * WHY THIS FILE EXISTS.
 *
 * Stats is four hundred lines of arithmetic with no tests, and arithmetic is the one place where a
 * defect does not look like a defect: a wrong total is still a total. Two real bugs lived here
 * undisturbed through three audits and a closing gate — a rewatch billed against the ANNOUNCED
 * episode count, and a timeline that dropped the shows you paused — because nothing was ever red.
 * The owner found the third by noticing a number that felt small.
 *
 * So these tests are not about coverage. Each one pins a rule the module states out loud somewhere
 * else, at the only place those rules turn into a figure you read.
 */
function item(o: Partial<StatsRawItem> = {}): StatsRawItem {
  return {
    id: crypto.randomUUID(),
    type: "serie",
    title: "T",
    original_title: null,
    poster_url: null,
    backdrop_url: null,
    year: 2020,
    runtime: 60,
    season_episodes: null,
    season_aired: null,
    episodes: null,
    user_rating: null,
    favorite: false,
    watched_at: null,
    tags: null,
    watched: false,
    in_progress: false,
    paused: false,
    dropped: false,
    current_season: null,
    current_episode: null,
    updated_at: null,
    season_years: null,
    season_ratings: null,
    season_posters: null,
    ...o,
  };
}

const HOURS = (n: number) => Math.round((n / 60) * 10) / 10;

describe("Hours Watched — the world's facts decide, not its announcements", () => {
  it("counts a completed series from what AIRED, ignoring an announced future season", () => {
    // TMDB announces a third season of 8; only 3 of them exist.
    const s = computeStats(
      [item({ watched: true, watched_at: "2026-03-01", season_episodes: [10, 8, 8], season_aired: [10, 8, 3], runtime: 50 })],
      [],
      null,
    );
    expect(s.hours.serie).toBe(HOURS((10 + 8 + 3) * 50));
  });

  /**
   * THE BUG THE OWNER FOUND. A title added through discover was born with `runtime = null` because
   * TMDB's `episode_run_time` is empty for essentially every modern series and the mapper had no
   * fallback. Nothing threw — the null simply became 0, and 0 reads like an answer.
   */
  it("is worth ZERO when the runtime is unknown — the silent failure worth naming", () => {
    const s = computeStats(
      [item({ watched: true, watched_at: "2026-07-24", season_aired: [8, 8], runtime: null })],
      [],
      null,
    );
    expect(s.hours.serie).toBe(0);
    // …and the title itself is still counted, which is exactly why the loss is invisible.
    expect(s.counts.serie).toBe(1);
  });

  it("counts an in-progress series up to where you stand, clamped to what aired", () => {
    const s = computeStats(
      [item({ in_progress: true, updated_at: "2026-05-01", season_aired: [10, 5], current_season: 2, current_episode: 9, runtime: 60 })],
      [],
      null,
    );
    // Season 1 in full, then season 2 clamped from a claimed 9 down to the 5 that exist.
    expect(s.hours.serie).toBe(HOURS((10 + 5) * 60));
  });

  it("still counts the time you spent on a show you dropped", () => {
    const s = computeStats(
      [item({ dropped: true, updated_at: "2026-05-01", season_aired: [10, 10], current_season: 2, current_episode: 3, runtime: 45 })],
      [],
      null,
    );
    expect(s.hours.serie).toBe(HOURS((10 + 3) * 45));
  });
});

describe("Rewatches — re-watching a running show means re-watching what EXISTS of it", () => {
  const airing = item({
    id: "x",
    watched: false,
    in_progress: true,
    updated_at: "2026-01-01",
    season_episodes: [10, 8, 8],   // announced
    season_aired: [10, 8, 3],      // real
    current_season: 3,
    current_episode: 3,
    runtime: 50,
  });
  const rw: RewatchStatItem[] = [{ media_item_id: "x", watched_on: "2026-06-01" } as RewatchStatItem];

  /**
   * This line read `season_episodes` — the announcement — while `seasonContributions` twenty lines
   * above had already been fixed to read `season_aired`. So the rewatch slice of the donut billed
   * five episodes nobody has seen, and disagreed with the per-type slice computed beside it.
   */
  it("bills the aired episodes, not the announced ones", () => {
    const s = computeStats([airing], rw, null);
    expect(s.hours.rewatches).toBe(HOURS((10 + 8 + 3) * 50));
    expect(s.rewatches).toBe(1);
  });

  it("a film rewatch is one runtime", () => {
    const f = item({ id: "f", type: "film", watched: true, watched_at: "2026-02-02", runtime: 148 });
    const s = computeStats([f], [{ media_item_id: "f", watched_on: "2026-02-03" } as RewatchStatItem], null);
    expect(s.hours.rewatches).toBe(HOURS(148));
  });

  it("does not inflate the unique-title count", () => {
    const s = computeStats([airing], rw, null);
    expect(s.counts.serie).toBe(1);
  });
});

describe("The timeline agrees with the hours — every card talks about the same titles", () => {
  /**
   * Activity used to test `watched || in_progress` while the hours and the counts tested
   * `hasWatchTime` (which includes paused and dropped). So a dropped show contributed hours and a
   * title, and produced no event — the one card on the page that disagreed with the others, under a
   * comment promising they never could.
   */
  it("gives a paused show its years, like the hours already did", () => {
    const s = computeStats(
      [item({ paused: true, updated_at: "2025-04-01", season_aired: [10], current_season: 1, current_episode: 6 })],
      [],
      null,
    );
    expect(s.activity).toEqual([{ label: "2025", count: 1 }]);
    expect(s.hours.serie).toBeGreaterThan(0);
  });

  it("gives a dropped show its years too", () => {
    const s = computeStats(
      [item({ dropped: true, updated_at: "2024-09-09", season_aired: [10], current_season: 1, current_episode: 2 })],
      [],
      null,
    );
    expect(s.activity).toEqual([{ label: "2024", count: 1 }]);
  });

  it("says nothing about a title you only plan to watch", () => {
    const s = computeStats([item({ season_aired: [10] })], [], null);
    expect(s.activity).toEqual([]);
    expect(s.counts.total).toBe(0);
    expect(s.hours.total).toBe(0);
  });

  it("attributes each season to ITS year, not to the title's", () => {
    const s = computeStats(
      [item({ watched: true, watched_at: "2026-01-01", season_aired: [10, 10], season_years: { "1": 2023, "2": 2024 }, runtime: 60 })],
      [],
      null,
    );
    expect(s.activity).toEqual([{ label: "2023", count: 1 }, { label: "2024", count: 1 }]);
    expect(s.hours.serie).toBe(HOURS(20 * 60));
    // …and a year filter keeps only that year's seasons.
    expect(computeStats([item({ watched: true, watched_at: "2026-01-01", season_aired: [10, 10], season_years: { "1": 2023, "2": 2024 }, runtime: 60 })], [], 2023).hours.serie)
      .toBe(HOURS(10 * 60));
  });
});

describe("Films", () => {
  it("counts a watched film once, in its watched year", () => {
    const f = item({ type: "film", watched: true, watched_at: "2026-04-04", runtime: 120 });
    expect(computeStats([f], [], null).hours.film).toBe(HOURS(120));
    expect(computeStats([f], [], 2026).hours.film).toBe(HOURS(120));
    expect(computeStats([f], [], 2025).hours.film).toBe(0);
  });

  it("ignores an unwatched film entirely", () => {
    expect(computeStats([item({ type: "film", runtime: 120 })], [], null).counts.film).toBe(0);
  });
});
