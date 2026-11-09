import { describe, it, expect } from "vitest";
import { computeStats } from "./computeStats";
import type { StatsRawItem, RewatchStatItem } from "../../service";
import { assertion, viewingDate } from "../../lib/viewing-history";
import type { HistoryAnalytics } from "../../lib/history-analytics";
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
    directors: null,
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
  it("keeps an unconfirmed legacy rewatch visible without billing today's episode catalogue", () => {
    const s = computeStats([airing], rw, null);
    expect(s.hours.rewatches).toBe(0);
    expect(s.unknownScopeEvents).toBe(1);
    expect(s.rewatches).toBe(1);
  });

  it("a legacy film rewatch needs a frozen runtime before contributing hours", () => {
    const f = item({ id: "f", type: "film", watched: true, watched_at: "2026-02-02", runtime: 148 });
    const s = computeStats([f], [{ media_item_id: "f", watched_on: "2026-02-03" } as RewatchStatItem], null);
    expect(s.hours.rewatches).toBe(0);
    expect(s.unknownDurationEvents).toBe(1);
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
    expect(HOURS(s.breakdown.rewatches.reduce((a, e) => a + (e.minutes ?? 0), 0))).toBe(s.hours.rewatches);
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
    const s = computeStats([{ ...jjk, favorite: true, cour_ratings: {2:9} }], [], 2024, cours);
    expect(s.topFavorites[0].seasonLabel).toBe("S2");
    expect(s.topFavorites[0].seasonPoster).toBe("https://anilist/2.jpg");
  });

  it("still says SEASON, and builds a TMDB url, for a plain series", () => {
    const plain = item({
      id: "p", type: "serie", favorite: true, watched: true, watched_at: "2026-01-01",
      season_aired: [10, 10], season_years: { "1": 2023, "2": 2024 },
      season_posters: ["/s1.jpg", "/s2.jpg"], runtime: 50,
    });
    const s = computeStats([{...plain,season_ratings:{2:9}}], [], 2024);
    expect(s.topFavorites[0].seasonLabel).toBe("S2");
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

describe("Wave 1 analytical contracts", () => {
  it("averages eligible season scores once per title across every annual consumer", () => {
    const row = item({ watched: true, season_episodes: [10, 10, 10], season_aired: [10, 10, 10], season_years: { 1: 2023, 2: 2024, 3: 2024 }, season_ratings: { 1: 8, 2: 2, 3: 10 }, user_rating: 9 });
    const annual = computeStats([row], [], 2024);
    expect(annual.avgRating).toBe(6);
    expect(annual.ratingDistribution.find((r) => r.score === 6)?.count).toBe(1);
    expect(annual.topFavorites).toHaveLength(0); // six is below the existing threshold
    expect(computeStats([{ ...row, favorite: true }], [], 2024).topFavorites[0].rating).toBe(6);
    expect(computeStats([row], [], null).avgRating).toBe(9);
  });
  it.each([[0, 0], [4, 4], [10, 10]])("counts %i known aired episodes without announced fallback", (aired, expected) => {
    const row = item({ watched: true, watched_at: "2024-01-01", episodes: 10, season_episodes: [10], season_aired: [aired] });
    expect(computeStats([row], [], null).hours.serie).toBe(expected);
    expect(computeStats([row], [{ media_item_id: row.id, watched_on: "2024-02-01" }], null).hours.rewatches).toBe(0); // legacy row carries no duration snapshot
  });
  it("keeps the legacy estimate only for unknown aired metadata", () => {
    const row = item({ watched: true, watched_at: "2024-01-01", season_episodes: [10], season_aired: null });
    expect(computeStats([row], [], null).hours.serie).toBe(10);
  });
  it("retains every qualified pick in stable order for the panel", () => {
    const rows = Array.from({ length: 9 }, (_, i) => item({ id: String(i), type: "film", watched: true, user_rating: 8 }));
    expect(computeStats(rows.reverse(), [], null).topFavorites.map((r) => r.item.id)).toEqual(["0", "1", "2", "3", "4", "5", "6", "7", "8"]);
  });
  it("includes a rewatch-only year in the selector", () => {
    expect(computeStats([], [{ media_item_id: "gone", watched_on: "2025-01-01" }], null).availableYears).toContain(2025);
  });
});

it("missing annual stamps never erase known all-time consumption", () => {
  const row = item({ watched: true, watched_at: "2024-01-01", season_episodes: [10, 10], season_aired: [10, 10], season_years: { 1: 2023 }, runtime: 30 });
  expect(computeStats([row], [], null).hours.serie).toBe(10);
  expect(computeStats([row], [], 2023).hours.serie).toBe(5);
  expect(computeStats([row], [], 2024).hours.serie).toBe(0); // unknown, not invented
});

describe("Annual rating attribution regression", () => {
  it("keeps Hannibal's annual seasonal mean exactly 8.75", () => {
    const row = item({ title: "Hannibal", watched: true, watched_at: "2026-01-01",
      season_episodes: [13, 13], season_aired: [13, 13], season_years: { 1: 2026, 2: 2026 },
      season_ratings: { 1: 8.5, 2: 9 }, user_rating: 9 });
    const annual = computeStats([row], [], 2026);
    expect(annual.topFavorites[0].rating).toBe(8.75);
    expect(row.season_ratings).toEqual({ 1: 8.5, 2: 9 });
  });
  it.each([true, false])("Black Clover: current-year unrated activity, current stamp=%s", (stamped) => {
    const row = item({ title: "Black Clover", type: "anime", user_rating: 9,
      in_progress: true, current_season: 2, current_episode: 1, updated_at: "2026-10-01",
      season_episodes: [10, 10], season_aired: [10, 3],
      season_years: stamped ? { 1: 2022, 2: 2026 } : { 1: 2022 }, season_ratings: { 1: 9 },
    });
    const annual = computeStats([row], [], 2026);
    expect(annual.counts.anime).toBe(1);
    expect(annual.hours.anime).toBeGreaterThan(0);
    expect(annual.avgRating).toBeNull();
    expect(annual.ratedCount).toBe(0);
    expect(annual.ratingDistribution.reduce((n, r) => n + r.count, 0)).toBe(0);
    expect(annual.topFavorites).toHaveLength(0);
    expect(computeStats([row], [], 2022).avgRating).toBe(9);
    const all = computeStats([row], [], null);
    expect(all.avgRating).toBe(9);
    expect(all.topFavorites[0].rating).toBe(9);
    // Wrapped may show activity, but an unrated current title cannot outrank a rated one via its old score.
    const rated = item({ id: "rated", type: "film", watched: true, watched_at: "2026-01-01", user_rating: 8, poster_url: "rated.jpg" });
    expect(computeStats([{ ...row, poster_url: "old.jpg" }, rated], [], 2026).wrappedPosters[0].poster_url).toBe("rated.jpg");
  });
  it("uses seasonal scores even when the whole series was watched in one year", () => {
    const row = item({ watched: true, watched_at: "2026-01-01", season_aired: [10, 10], season_episodes: [10, 10],
      season_years: { 1: 2026, 2: 2026 }, season_ratings: { 1: 2, 2: 10 }, user_rating: 9 });
    const annual = computeStats([row], [], 2026);
    expect(annual.avgRating).toBe(6);
    expect(annual.ratedCount).toBe(1);
    expect(annual.ratingDistribution.find((r) => r.score === 6)?.count).toBe(1);
    expect(annual.topFavorites).toHaveLength(0);
    expect(computeStats([row], [], null).avgRating).toBe(9);
  });
  it("uses cour ratings and years through the anime lens", () => {
    const row = item({ tmdb_id: 100, type: "anime", in_progress: true, current_season: 1, current_episode: 11,
      updated_at: "2026-10-01", season_aired: [20], season_episodes: [20], user_rating: 9,
      cour_years: { 1: 2022, 2: 2026 }, cour_ratings: { 1: 9 } });
    const cours = new Map<number, AnimeCoursRow>([[100, { tmdb_id: 100, source: "anilist", cours: [
      { season: 1, anilist_id: 1, title: "Old", poster_url: null, year: 2022, end_year: 2022, episodes: 10, start_episode: 1, end_episode: 10 },
      { season: 2, anilist_id: 2, title: "New", poster_url: null, year: 2026, end_year: 2026, episodes: 10, start_episode: 11, end_episode: 20 },
    ] }]]);
    expect(computeStats([row], [], 2026, cours)).toMatchObject({ avgRating: null, ratedCount: 0, topFavorites: [] });
    expect(computeStats([{ ...row, cour_ratings: { 1: 9, 2: 7 } }], [], 2026, cours).avgRating).toBe(7);
    expect(computeStats([row], [], null, cours).avgRating).toBe(9);
  });
});

describe("Rating distribution preserves real decimal bounds",()=>{
  it.each([[6.5,8.75],[8.5,9.5],[9.5,10]])("retains exact ratings %s to%s without inventing higher integer scores",(min,max)=>{
    const rows=[min,max].map((score,index)=>item({id:`rating${index}`,type:"film",watched:true,watched_at:"2026-04-01",user_rating:score}));
    const stats=computeStats(rows,[],2026,new Map(),{records:[],ratings:[]});
    expect(stats.ratingDistribution[0].score).toBe(min);
    expect(stats.ratingDistribution.at(-1)?.score).toBe(max);
    expect(stats.ratingDistribution.reduce((n,d)=>n+d.count,0)).toBe(2);
    expect(stats.ratingDistribution.find(d=>d.score===max)?.count).toBe(1);
  });
});


describe("Annual Top Picks distinguish first viewing from rewatch activity",()=>{
  it.each([true,false])("a legacy rewatch alone cannot qualify a film, favorite=%s",favorite=>{
    const film=item({id:"film",type:"film",title:"Earlier film",watched:true,watched_at:"2019-08-04",
      runtime:120,user_rating:favorite ? 7.5:9,favorite});
    const rewatches=[{media_item_id:film.id,watched_on:"2026-04-07"}];
    const annual=computeStats([film],rewatches,2026);
    expect(annual.topFavorites).toEqual([]);
    expect(annual.counts.film).toBe(0);
    expect(annual.rewatches).toBe(1);
    expect(annual.activity).toEqual([{label:"2026-04",count:1}]);
    expect(computeStats([film],rewatches,2019).topFavorites[0].item.id).toBe(film.id);
    expect(computeStats([film],rewatches,null).topFavorites[0].item.id).toBe(film.id);
    expect(film.user_rating).toBe(favorite ? 7.5:9);
  });
});


it("Hannibal Top Picks describe only the two scored seasons, excluding unrated S3 progress",()=>{
  const row=item({title:"Hannibal",type:"serie",in_progress:true,current_season:3,current_episode:1,
    updated_at:"2026-10-28",season_aired:[13,13,13],season_episodes:[13,13,13],season_years:{1:2026,2:2026,3:2026},
    season_ratings:{1:8.5,2:9},season_posters:["/s1.jpg","/s2.jpg","/s3.jpg"],user_rating:9});
  const result=computeStats([row],[],2026);
  expect(result.topFavorites[0]).toMatchObject({rating:8.75,seasonLabel:"S1–S2",seasonPoster:null});
  expect(result.breakdown.serie[0].episodes).toBe(27);
  expect(result.avgRating).toBe(8.75);
});


describe("Whole-work Top Picks presentation",()=>{
  const whole=()=>item({title:"Kuroko",type:"anime",watched:true,status:"ended",current_season:3,current_episode:25,
    season_aired:[25,25,25],season_episodes:[25,25,25],season_years:{1:2018,2:2018,3:2018},
    season_ratings:{1:8.5,2:8.5,3:8.5},user_rating:8.5,watched_at:"2018-04-21",runtime:24});
  it("omits redundant season identifiers for all seasons viewed and rated in one year",()=>{
    const row=whole(),s=computeStats([row],[],2018);
    expect(s.topFavorites[0]).toMatchObject({rating:8.5,seasonLabel:null,seasonPoster:null});
    expect(s.hours.total).toBe(30);expect(s.episodes).toBe(75);
    expect(row.season_ratings).toEqual({1:8.5,2:8.5,3:8.5});
  });
  it("keeps the scored scope if a watched season is not rated",()=>{
    const row={...whole(),season_ratings:{1:8.5,2:9}};
    expect(computeStats([row],[],2018).topFavorites[0]).toMatchObject({rating:8.75,seasonLabel:"S1–S2"});
  });
  it("keeps scopes for multi-year first viewing, including a single selected season",()=>{
    const row={...whole(),season_years:{1:2018,2:2018,3:2019}};
    expect(computeStats([row],[],2018).topFavorites[0].seasonLabel).toBe("S1–S2");
    expect(computeStats([row],[],2019).topFavorites[0].seasonLabel).toBe("S3");
  });
  it("does not turn a partial or unknown catalogue into an entire-work claim",()=>{
    const row={...whole(),season_episodes:[25,25,25,12],season_aired:[25,25,25,0]};
    expect(computeStats([row],[],2018).topFavorites[0].seasonLabel).toBe("S1–S3");
  });
});


it("classifies Knight as completed without changing its recorded consumption", () => {
  const knight = item({ title: "A Knight of the Seven Kingdoms", status: "ended",
    in_progress: true, watched: false, current_season: 1, current_episode: 6,
    season_aired: [6], season_episodes: [6], watched_at: "2026-04-06", runtime: 34 });
  const stats = computeStats([knight], [], null);
  expect(stats.statusCounts.serie).toMatchObject({ watched: 1, inProgress: 0, caughtUp: 0 });
  expect(stats.hours.total).toBe(204 / 60);
  expect(knight).toMatchObject({ in_progress: true, watched: false, watched_at: "2026-04-06" });
});


it("keeps a returned title out of active/completed counts without adding hours",()=>{
  const base=item({status:"ongoing",watched:false,in_progress:false,current_season:1,current_episode:3,season_aired:[3,1],season_episodes:[3,8],season_years:{"1":2024},resume_required:true});
  const waiting=computeStats([base],[],null,new Map());
  const active=computeStats([{...base,resume_required:false,in_progress:true}],[],null,new Map());
  expect(waiting.statusCounts.serie).toMatchObject({awaitingResume:1,inProgress:0,watched:0,caughtUp:0});
  expect(active.statusCounts.serie).toMatchObject({awaitingResume:0,inProgress:1});
  expect(waiting.hours).toEqual(active.hours);
});


describe("First viewing ratings and deterministic Wrapped",()=>{
  const film=(id:string,score:number,year=2026)=>item({id,type:"film",watched:true,watched_at:`${year}-04-03`,user_rating:score,poster_url:`${id}.jpg`,runtime:120});
  it("excludes a rewatch-only film from annual ratings, average and Wrapped, retaining its activity",()=>{
    const old=film("old",10,2019),fresh=film("fresh",8);
    const stats=computeStats([old,fresh],[{media_item_id:old.id,watched_on:"2026-06-01"}],2026);
    expect(stats.ratedCount).toBe(1);expect(stats.avgRating).toBe(8);
    expect(stats.ratingDistribution.filter(r=>r.count)).toEqual([{score:8,count:1}]);
    expect(stats.wrappedPosters.map(i=>i.id)).toEqual(["fresh"]);
    expect(stats.wrappedSummary).toMatchObject({film:1,seriesAnime:0,total:1});
    expect(stats.rewatches).toBe(1);expect(stats.counts.film).toBe(1);
    expect(computeStats([old,fresh],[],null).ratedCount).toBe(2);
    expect(stats.breakdown.film[0].rating).toBe(8);
  });
  it("keeps all ties at the third-place score with stable order, rating ahead of favorite",()=>{
    const rows=[film("a",10),film("b",9.5),film("c",9),film("d",9),film("e",9),{...film("f",8),favorite:true}];
    const expected=["a","b","c","d","e"];
    expect(computeStats(rows,[],2026).wrappedPosters.map(i=>i.id)).toEqual(expected);
    expect(computeStats([...rows].reverse(),[],2026).wrappedPosters.map(i=>i.id)).toEqual(expected);
  });
  it("includes a film watched then rewatched in the same year only once in the ratings",()=>{
    const fresh=film("f",9);const stats=computeStats([fresh],[{media_item_id:fresh.id,watched_on:"2026-07-01"}],2026);
    expect(stats.ratedCount).toBe(1);expect(stats.wrappedPosters).toHaveLength(1);
  });
});


it("annual series ratings exclude an old-season rewatch but retain a newly viewed season",()=>{
  const series=item({id:"series",type:"serie",watched:true,watched_at:"2020-06-01",user_rating:10,
    poster_url:"series.jpg",season_episodes:[10],season_aired:[10],season_years:{1:2020},season_ratings:{1:10}});
  const rewatches=[{media_item_id:series.id,watched_on:"2026-08-01"}];
  const oldOnly=computeStats([series],rewatches,2026);
  expect(oldOnly.avgRating).toBeNull();expect(oldOnly.ratedCount).toBe(0);expect(oldOnly.wrappedPosters).toEqual([]);
  const expanded={...series,season_episodes:[10,10],season_aired:[10,10],season_years:{1:2020,2:2026},season_ratings:{1:10,2:8}};
  const fresh=computeStats([expanded],rewatches,2026);
  expect(fresh.avgRating).toBe(8);expect(fresh.wrappedPosters[0].user_rating).toBe(8);
  expect(fresh.breakdown.serie[0].rating).toBe(8);
});


describe("Annual global opinions have a proven, frozen scope",()=>{
  const basis=(sizes:number[],score=8.5)=>({kind:"WHOLE_TITLE" as const,key:"whole:frozen",number:1,score,
    snapshot_id:"snapshot",mapping_snapshot_id:null,ids:sizes.flatMap((n,s)=>Array.from({length:n},(_,ep)=>s*100+ep+1)),
    episodes:sizes.flatMap((n,s)=>Array.from({length:n},(_,ep)=>({season_number:s+1,episode:{id:s*100+ep+1,number:ep+1}})))});
  it("restores a whole-series opinion only when every episode was first viewed in that year",()=>{
    const friends=item({id:"friends",poster_url:"friends.jpg",tmdb_id:42,watched:true,watched_at:"2026-06-01",current_season:2,current_episode:3,
      season_episodes:[4,3],season_aired:[4,3],season_years:{1:2026,2:2026},user_rating:8.5});
    const proofs={friends:basis([4,3])};
    const stats=computeStats([friends],[],2026,new Map(),{records:[],ratings:[]},proofs);
    expect(stats.avgRating).toBe(8.5);expect(stats.topFavorites[0]).toMatchObject({rating:8.5,seasonLabel:null});
    expect(stats.breakdown.serie[0].rating).toBe(8.5);expect(stats.wrappedPosters[0].user_rating).toBe(8.5);
    const mixed={...friends,season_years:{1:2025,2:2026}};
    expect(computeStats([mixed],[],2026,new Map(),{records:[],ratings:[]},proofs).ratedCount).toBe(0);
  });
  it("does not guess a global scope or transfer an older season note to a new season",()=>{
    const row=item({id:"clover",tmdb_id:43,favorite:true,in_progress:true,current_season:2,current_episode:6,
      season_episodes:[170,26],season_aired:[170,6],season_years:{1:2022,2:2026},season_ratings:{1:8.5},user_rating:8.5});
    const stats=computeStats([row],[],2026);
    expect(stats.ratedCount).toBe(0);expect(stats.topFavorites).toEqual([]);
    expect(stats.hours.total).toBeGreaterThan(0);
  });
  it("forty new films and four rewatches remain forty discoveries even with one overlap",()=>{
    const fresh=Array.from({length:40},(_,n)=>item({id:`fresh${n}`,type:"film",watched:true,watched_at:"2026-03-01",runtime:120}));
    const old=Array.from({length:3},(_,n)=>item({id:`old${n}`,type:"film",watched:true,watched_at:"2020-01-01",runtime:120}));
    const rewatches=[fresh[0],...old].map(i=>({media_item_id:i.id,watched_on:"2026-06-01"}));
    const stats=computeStats([...fresh,...old],rewatches,2026);
    expect(stats.counts.film).toBe(40);expect(stats.wrappedSummary.film).toBe(40);expect(stats.rewatches).toBe(4);
    expect(computeStats([...fresh,...old],rewatches,null).counts.film).toBe(43);
  });
});


it("keeps a frozen S1 opinion after S2 arrives and does not revive it after a correction",()=>{
 const row=item({id:"knight",tmdb_id:44,user_rating:8.5,watched:false,resume_required:true,current_season:1,current_episode:6,
   season_episodes:[6,6],season_aired:[6,0],season_years:{1:2026},watched_at:"2026-04-06"});
 const range={season_key:"tmdb-season:1",season_number_at_recording:1,episode_from:1,episode_to:6,episode_ids:[1,2,3,4,5,6],minutes:0,duration_basis:"MILESTONE" as const};
 const completion={...assertion("COMPLETION",viewingDate(),[range]),id:"completion",media_item_id:row.id,work_key:"tv:44",title_snapshot:row.title,media_type_snapshot:"serie",recorded_at:"2026-11-08",retracted_at:null};
 const rating={id:"rated",media_item_id:row.id,work_key:"tv:44",scope_kind:"SEASON" as const,scope_key:"tmdb-season:444",scope_number_at_recording:1,
   viewing_record_id:completion.id,episode_ids:[1,2,3,4,5,6],score:8.5,previous_rating_id:null,recorded_at:"2026-11-08"};
 const history:HistoryAnalytics={records:[completion],ratings:[rating]};
 const before=computeStats([row],[],2026,new Map(),history);
 expect(before.topFavorites[0]).toMatchObject({rating:8.5,seasonLabel:"S1"});expect(before.breakdown.serie[0].rating).toBe(8.5);
 const cleared={...rating,id:"clear",viewing_record_id:null,episode_ids:null,score:null,previous_rating_id:rating.id,recorded_at:"2026-11-09"};
 expect(computeStats([row],[],2026,new Map(),{...history,ratings:[rating,cleared]}).ratedCount).toBe(0);
});

it("whole-title rating tombstones retain their lineage and suppress old scores",()=>{
 const row=item({id:"friends",tmdb_id:45,user_rating:8.5,watched:true,current_season:2,current_episode:2,season_episodes:[2,2],season_aired:[2,2],season_years:{1:2026,2:2026}});
 const ranges=[1,2].map(n=>({season_key:`tmdb-season:${n}`,season_number_at_recording:n,episode_from:1,episode_to:2,episode_ids:[n*10+1,n*10+2],minutes:0,duration_basis:"MILESTONE" as const}));
 const completion={...assertion("COMPLETION",viewingDate(),ranges),id:"completed",media_item_id:row.id,work_key:"tv:45",title_snapshot:row.title,media_type_snapshot:"serie",recorded_at:"2026-11-08",retracted_at:null};
 const rated={id:"rating",media_item_id:row.id,work_key:"tv:45",scope_kind:"WHOLE_TITLE" as const,scope_key:"whole:frozen",scope_number_at_recording:1,viewing_record_id:completion.id,episode_ids:[11,12,21,22],score:8.5,previous_rating_id:null,recorded_at:"2026-11-08"};
 const history:HistoryAnalytics={records:[completion],ratings:[rated]};
 expect(computeStats([row],[],2026,new Map(),history).avgRating).toBe(8.5);
 expect(computeStats([{...row,season_years:{1:2025,2:2026}}],[],2026,new Map(),history).avgRating).toBeNull();
 const clear={...rated,id:"clear",score:null,viewing_record_id:null,episode_ids:null,previous_rating_id:rated.id,recorded_at:"2026-11-09"};
 expect(computeStats([row],[],2026,new Map(),{...history,ratings:[rated,clear]}).avgRating).toBeNull();
});
