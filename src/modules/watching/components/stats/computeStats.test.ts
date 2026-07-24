import { describe, it, expect } from "vitest";
import { computeStats } from "./computeStats";
import type { StatsRawItem, RewatchStatItem } from "../../service";
import type { AnimeCoursRow } from "../../types";

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
    tmdb_id: null,
    status: null,
    caught_up_at: null,
    cour_years: null,
    cour_ratings: null,
    season_end_dates: null,
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

// Exact, like the code: hours are minutes / 60, and the rounding happens at render.
const HOURS = (n: number) => n / 60;

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

/**
 * THE BREAKDOWN IS THE TOTAL, ITEMISED — not a second opinion about it.
 *
 * The panel that explains a slice would be worse than useless if its rows summed to something
 * other than the slice: you would lose trust in both numbers. So the invariant under test is not
 * "the list looks right", it is "the list IS the total".
 */
describe("breakdown — the working behind each slice", () => {
  const lib = [
    item({ id: "a", type: "serie", watched: true, watched_at: "2026-01-01", season_aired: [10, 10], runtime: 50 }),
    item({ id: "b", type: "serie", in_progress: true, updated_at: "2026-02-01", season_aired: [8], current_season: 1, current_episode: 4, runtime: 60 }),
    item({ id: "c", type: "serie", watched: true, watched_at: "2026-03-01", season_aired: [12], runtime: null }),
    item({ id: "d", type: "film", watched: true, watched_at: "2026-04-01", runtime: 120 }),
  ];

  /**
   * TO THE MINUTE, not to the tenth of an hour. `toH` used to round, and six minutes of slack is
   * invisible until a list of rows sits under the figure: the card printed 200h 42m above rows
   * that summed to 200h 39m. Found by opening the panel and adding it up, not by a test — this is
   * the test so it stays found.
   */
  it("sums to exactly the slice it explains, to the minute", () => {
    const s = computeStats(lib, [], null);
    const sum = (es: { minutes: number }[]) => es.reduce((a, e) => a + e.minutes, 0);
    expect(Math.round(s.hours.serie * 60)).toBe(sum(s.breakdown.serie));
    expect(Math.round(s.hours.film * 60)).toBe(sum(s.breakdown.film));
  });

  it("ranks by contribution, biggest first", () => {
    const s = computeStats(lib, [], null);
    const mins = s.breakdown.serie.map((e) => e.minutes);
    expect(mins).toEqual([...mins].sort((x, y) => y - x));
    expect(s.breakdown.serie[0].item.id).toBe("a");   // 20 × 50 = 1000
  });

  /** The whole point of the panel: a title worth nothing is IN the list, not absent from it. */
  it("keeps a title whose runtime is unknown, at zero, with its episode count intact", () => {
    const s = computeStats(lib, [], null);
    const c = s.breakdown.serie.find((e) => e.item.id === "c");
    expect(c).toBeDefined();
    expect(c!.minutes).toBe(0);
    expect(c!.runtime).toBeNull();
    expect(c!.episodes).toBe(12);
  });

  it("carries the arithmetic the row prints", () => {
    const s = computeStats(lib, [], null);
    const bEntry = s.breakdown.serie.find((e) => e.item.id === "b")!;
    expect(bEntry.episodes).toBe(4);
    expect(bEntry.runtime).toBe(60);
    expect(bEntry.minutes).toBe(240);
  });

  it("drops a title that contributed no episode to the period", () => {
    const older = item({ id: "old", watched: true, watched_at: "2020-01-01", season_aired: [10], runtime: 40 });
    const s = computeStats([...lib, older], [], 2026);
    expect(s.breakdown.serie.map((e) => e.item.id)).not.toContain("old");
  });

  it("follows the year filter, so the panel can never span a different period than the donut", () => {
    const s2026 = computeStats(lib, [], 2026);
    const s2019 = computeStats(lib, [], 2019);
    expect(s2026.breakdown.film).toHaveLength(1);
    expect(s2019.breakdown.film).toHaveLength(0);
  });

  it("orders rewatches by date, newest first — an event log is not a ranking", () => {
    const rws = [
      { media_item_id: "d", watched_on: "2026-02-02" },
      { media_item_id: "d", watched_on: "2026-08-08" },
      { media_item_id: "d", watched_on: "2026-05-05" },
    ] as RewatchStatItem[];
    const s = computeStats(lib, rws, null);
    expect(s.breakdown.rewatches.map((e) => e.watchedOn)).toEqual(["2026-08-08", "2026-05-05", "2026-02-02"]);
    expect(HOURS(s.breakdown.rewatches.reduce((a, e) => a + e.minutes, 0))).toBe(s.hours.rewatches);
  });
});

/**
 * A LUMPED ANIME IS NOT ONE SEASON, AND THIS PAGE USED TO THINK IT WAS.
 *
 * Real data, measured from the owner's row on 2026-07-25: Jujutsu Kaisen is stored as
 * `season_episodes: [59]` with `season_years: {}`, because TMDB lumps the whole show into one
 * season. The three years he actually stamped live in `cour_years: {1:2021, 2:2024, 3:2026}` —
 * AniList knows the show as three cours of 24 / 23 / 12.
 *
 * Reading the raw columns, this page found no stamps, fell back to `updated_at`, and filed all 59
 * episodes under 2026. Three years of watching collapsed onto the year he last touched the row —
 * on the page whose entire job is to date things. He found it by opening the panel.
 */
describe("the lens — an anime TMDB lumps into one season", () => {
  const JJK_ID = 95479;
  const jjk = item({
    id: "jjk",
    tmdb_id: JJK_ID,
    type: "anime",
    status: "ongoing",
    in_progress: true,
    updated_at: "2026-07-16",
    runtime: 24,
    episodes: 59,
    season_episodes: [59],
    season_aired: [59],
    current_season: 1,
    current_episode: 59,
    season_years: {},
    cour_years: { "1": 2021, "2": 2024, "3": 2026 },
  });
  const cour = (season: number, episodes: number, start: number, year: number) => ({
    season, anilist_id: 1000 + season, title: `Cour ${season}`,
    poster_url: `https://anilist/${season}.jpg`,
    year, end_year: year, episodes,
    start_episode: start, end_episode: start + episodes - 1,
  });
  const cours = new Map<number, AnimeCoursRow>([
    [JJK_ID, {
      tmdb_id: JJK_ID,
      source: "anilist",
      cours: [cour(1, 24, 1, 2020), cour(2, 23, 25, 2023), cour(3, 12, 48, 2026)],
    }],
  ]);

  it("splits the hours across the years you stamped, cour by cour", () => {
    const at = (y: number) => computeStats([jjk], [], y, cours).hours.anime;
    expect(at(2021)).toBe(HOURS(24 * 24));
    expect(at(2024)).toBe(HOURS(23 * 24));
    expect(at(2026)).toBe(HOURS(12 * 24));
  });

  it("without the lens it collapses onto one year — the bug, pinned", () => {
    // Same row, no cours handed in: every episode lands on `updated_at`'s year.
    expect(computeStats([jjk], [], 2026).hours.anime).toBe(HOURS(59 * 24));
    expect(computeStats([jjk], [], 2021).hours.anime).toBe(0);
  });

  it("all-time is unchanged either way — only the ATTRIBUTION was wrong", () => {
    expect(computeStats([jjk], [], null, cours).hours.anime).toBe(HOURS(59 * 24));
  });

  it("counts the title in each year it actually contributed to", () => {
    for (const y of [2021, 2024, 2026]) {
      expect(computeStats([jjk], [], y, cours).counts.anime).toBe(1);
    }
    expect(computeStats([jjk], [], 2022, cours).counts.anime).toBe(0);
  });

  it("gives the timeline one event per cour, not one per show", () => {
    const s = computeStats([jjk], [], null, cours);
    expect(s.activity).toEqual([
      { label: "2021", count: 1 },
      { label: "2024", count: 1 },
      { label: "2026", count: 1 },
    ]);
  });

  it("offers the cour years in the year picker", () => {
    expect(computeStats([jjk], [], null, cours).availableYears).toEqual(
      expect.arrayContaining([2026, 2024, 2021]),
    );
  });

  /**
   * ONE NOUN. A cour is labelled "Season" like everything else, because `StatusCard` and
   * `SeasonHistoryStrip` already say "Season 2" for a lumped anime — a second word here would make
   * this the only page speaking it, and split the vocabulary between two kinds of anime.
   */
  it("labels a cour a SEASON like the rest of the app, and hands back its own artwork", () => {
    const s = computeStats([{ ...jjk, favorite: true }], [], 2024, cours);
    expect(s.topFavorites[0].seasonLabel).toBe("Season 2");
    expect(s.topFavorites[0].seasonPoster).toBe("https://anilist/2.jpg");
  });

  it("still says SEASON, and builds a TMDB url, for a plain series", () => {
    const plain = item({
      id: "p", type: "serie", favorite: true, watched: true, watched_at: "2026-01-01",
      season_aired: [10, 10], season_years: { "1": 2023, "2": 2024 },
      season_posters: ["/s1.jpg", "/s2.jpg"], runtime: 50,
    });
    const s = computeStats([plain], [], 2024);
    expect(s.topFavorites[0].seasonLabel).toBe("Season 2");
    expect(s.topFavorites[0].seasonPoster).toBe("https://image.tmdb.org/t/p/w500/s2.jpg");
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
