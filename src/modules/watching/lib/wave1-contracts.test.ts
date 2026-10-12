import { describe, it, expect } from "vitest";
import { batchOutcome } from "../../../../supabase/functions/_shared/batch-outcome";
import { providerRegressed, confirmedGrowth } from "../../../../supabase/functions/_shared/provider-progress";
import { collaborators, experienceSummary } from "./person-experience";
import { creditRole, isDirectorCredit, followDepartment } from "./credit-roles";
import { hasAnyField, ANALYTICAL_FIELDS, PEOPLE_FIELDS } from "./mutation-dependencies";
import { priorityPageRanges, watchlistFilter } from "./watchlist-page";
import { computeWatchingAchievements } from "../components/stats/achievements";
import { episodeCountsForTime } from "./episode-counts";
import { fetchAllRows } from "./pagination";
import { watchingTargetReached } from "../../goals/lib/watching-target";
import type { PersonTitle } from "../service";
const title = (over: Partial<PersonTitle> = {}) => ({ id: "a", tmdb_id: 1, type: "film", watched: true, in_progress: false, paused: false, dropped: false, year: 2020, user_rating: 8, cast_members: [], directors: [], ...over }) as PersonTitle;
describe("Wave 1 contracts", () => {
  it.each([[0, 0, 200, "success"], [2, 0, 200, "success"], [2, 1, 207, "partial"], [0, 3, 500, "failure"]])("reports batch %i successes / %i failures", (success, failed, status, outcome) => {
    expect(batchOutcome(success as number, failed as number)).toMatchObject({ status, outcome, ok: outcome === "success" });
  });
  it("preserves the Kuroko snapshot across degradation and restoration", () => {
    const stable = [26, 26, 26];
    const degraded = [26, 26, 25];
    expect(providerRegressed(stable, degraded)).toBe(true);
    const retained = providerRegressed(stable, degraded) ? stable : degraded;
    expect(confirmedGrowth(retained, stable, [null, null, "2015-06-30"], [null, null, "2015-06-30"])).toBe(false);
    expect(retained).toEqual(stable);
    expect(providerRegressed(stable, [26, 26])).toBe(true);
  });
  it("distinguishes genuine dated growth from restored old content", () => {
    expect(confirmedGrowth([26], [27], ["2015-06-30"], ["2026-10-10"])).toBe(true);
    expect(confirmedGrowth([25], [26], ["2015-06-30"], ["2015-06-30"])).toBe(false);
    expect(confirmedGrowth(null, [26], null, ["2015-06-30"])).toBe(false);
  });
  it("counts each collaborator once per provider work despite duplicate and dual credits", () => {
    const person = { id: 2, name: "Dual role", role: "director" };
    const one = title({ cast_members: [person, person], directors: [person, person] });
    const two = title({ id: "b", tmdb_id: 2, cast_members: [person] });
    const duplicate = title({ id: "copy", tmdb_id: 1, cast_members: [person] });
    const unexperienced = title({ id: "want", tmdb_id: 3, watched: false, want_to_watch: true, cast_members: [person] });
    expect(collaborators([one, two, duplicate, unexperienced], 1)[0]).toMatchObject({ id: 2, count: 2, isDirector: false });
  });
  it("labels creator collaborators without inventing an acting credit", () => {
    expect(collaborators([title({ type: "serie", directors: [{ id: 2, name: "Creator", role: "creator" }] })], 1)[0]?.roleLabel).toBe("Creator");
  });
  it("keeps engaged experience and completion separate and excludes future/watchlist ratings", () => {
    const summary = experienceSummary([title(), title({ id: "b", tmdb_id: 2, watched: false, in_progress: true, user_rating: 6 }), title({ watched: false, want_to_watch: true, user_rating: 10 }), title({ release_date: "2099-01-01", user_rating: 10 })]);
    expect(summary.experienced).toHaveLength(2);
    expect(summary.completed).toHaveLength(1);
    expect(summary.avgRating).toBe(7);
  });
  it("classifies TV creators without treating producers as directors", () => {
    expect(creditRole("Creator", "serie")).toBe("creator");
    expect(creditRole("Executive Producer", "serie")).toBe("production");
    expect(creditRole("Series Director", "anime")).toBe("director");
    expect(isDirectorCredit({}, "serie")).toBe(false);
    expect(isDirectorCredit({}, "film")).toBe(true);
    expect(isDirectorCredit({ role: "creator" }, "serie")).toBe(false);
  });
  it("does not complete a goal at 499/500 despite rounded display", () => {
    expect(Math.round(499 / 500 * 100)).toBe(100);
    expect(watchingTargetReached(499, 500)).toBe(false);
    expect(watchingTargetReached(500, 500)).toBe(true);
    expect(watchingTargetReached(501, 500)).toBe(true);
    expect(watchingTargetReached(0, 0)).toBe(false);
  });
  it("detects nullable analytical edits but ignores notes and routing metadata", () => {
    expect(hasAnyField({ user_rating: null }, ANALYTICAL_FIELDS)).toBe(true);
    expect(hasAnyField({ cour_years: null }, ANALYTICAL_FIELDS)).toBe(true);
    expect(hasAnyField({ cour_ratings: {} }, ANALYTICAL_FIELDS)).toBe(true);
    expect(hasAnyField({ notes: "edit", type: "film" }, ANALYTICAL_FIELDS)).toBe(false);
    expect(hasAnyField({ user_rating: null }, PEOPLE_FIELDS)).toBe(false);
    expect(hasAnyField({ paused: false }, PEOPLE_FIELDS)).toBe(true);
  });
  it("reads beyond 1000 and handles exact page boundaries", async () => {
    const source = Array.from({ length: 2000 }, (_, id) => ({ id }));
    const ranges: number[] = [];
    const rows = await fetchAllRows<{ id: number }>((from, to) => { ranges.push(from); return Promise.resolve({ data: source.slice(from, to + 1), error: null }); });
    expect(rows).toHaveLength(2000);
    expect(ranges).toEqual([0, 1000, 2000]);
    await expect(fetchAllRows(() => Promise.resolve({ data: null, error: new Error("read failed") }))).rejects.toThrow("read failed");
  });
});

it("pages across priority buckets beyond the former 100-title limit", () => {
  expect(priorityPageRanges([10, 60, 30, 20], 50)).toEqual([null, { from: 40, to: 59 }, { from: 0, to: 29 }, null]);
  expect(priorityPageRanges([10, 60, 30, 20], 100)).toEqual([null, null, null, { from: 0, to: 19 }]);
});
it("preserves released and search filters together, including punctuation", () => {
  const filter = watchlistFilter('Title, ("part")', "release_date.lte.2026-10-11,status.eq.released");
  expect(filter).toContain("and(or(release_date.lte.");
  expect(filter).toContain("or(title.ilike.");
  expect(watchlistFilter("", null)).toBeNull();
});
it("does not award Marathoner by rounding 2999.6 hours", () => {
  expect(computeWatchingAchievements([], 2999.6, []).find((a) => a.key === "marathoner")?.unlocked).toBe(false);
  expect(computeWatchingAchievements([], 3000, []).find((a) => a.key === "marathoner")?.unlocked).toBe(true);
});

it("shares duration counts for known zero, unknown, partial and full metadata", () => {
  expect(episodeCountsForTime({ season_episodes: [10], season_aired: [0] })).toEqual([0]);
  expect(episodeCountsForTime({ season_episodes: [10], season_aired: null })).toEqual([10]);
  expect(episodeCountsForTime({ season_episodes: [10] })).toEqual([10]);
  expect(episodeCountsForTime({ season_episodes: [10], season_aired: [4] })).toEqual([4]);
  expect(episodeCountsForTime({ season_episodes: [10], season_aired: [10] })).toEqual([10]);
});

it("does not inflate personal experience from duplicate TV/anime classifications", () => {
  const result = experienceSummary([title({ type: "serie" }), title({ id: "copy", type: "anime", watched: false, in_progress: true, user_rating: 6 })]);
  expect(result.experienced).toHaveLength(1);
  expect(result.completed).toHaveLength(1);
  expect(result.avgRating).toBe(8);
});

describe("Review role and React identity regressions", () => {
  it.each([
    ["creator", "serie", false, "Creating"], ["director", "serie", false, "Directing"],
    [null, "serie", false, null], [null, "anime", false, null],
    [null, "film", false, "Directing"], ["production", "serie", false, "Production"],
    [null, "serie", true, "Acting"], [null, "anime", true, "Voice Acting"],
  ])("preserves follow role %s / %s / cast=%s", (role, type, cast, expected) => {
    expect(followDepartment(role as string | null, type as string, cast as boolean)).toBe(expected);
  });
});
