import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { goalMatchesMedia, goalMetricLabel, goalWouldCount } from "./goal-contribution";
import type { WatchingGoalSummary } from "@/modules/goals/service";

// The bridge's ONLY decision — does this title count towards that goal? — was untested. It is the
// difference between a "+1" ripple you earned and one you did not. `goalWouldCount` reads the
// clock, so it is frozen.

const goal = (over: Partial<WatchingGoalSummary> = {}): WatchingGoalSummary => ({
  id: "g", title: "Watch 50 films in 2026", progress: 0,
  metric_key: "films", metric_period: "year", metric_year: 2026, metric_target: 50, metric_current: 12,
  ...over,
});

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-09-13T12:00:00Z")); });
afterEach(() => vi.useRealTimers());

describe("goalMatchesMedia — type AND period must match", () => {
  it("matches a film watched this year to a 'films in 2026' goal", () => {
    expect(goalMatchesMedia(goal(), { type: "film", watched_at: "2026-03-01" })).toBe(true);
  });
  it("refuses the wrong type", () => {
    expect(goalMatchesMedia(goal(), { type: "serie", watched_at: "2026-03-01" })).toBe(false);
    expect(goalMatchesMedia(goal({ metric_key: "series" }), { type: "anime", watched_at: "2026-03-01" })).toBe(false);
  });
  it("'titles' counts every type", () => {
    for (const type of ["film", "serie", "anime"]) {
      expect(goalMatchesMedia(goal({ metric_key: "titles" }), { type, watched_at: "2026-03-01" })).toBe(true);
    }
  });
  it("a year-scoped goal needs a date, in that year", () => {
    expect(goalMatchesMedia(goal(), { type: "film", watched_at: null })).toBe(false);
    expect(goalMatchesMedia(goal(), { type: "film", watched_at: "2025-12-31" })).toBe(false);
  });
  it("an all-time goal ignores the date entirely", () => {
    expect(goalMatchesMedia(goal({ metric_period: null, metric_year: null }), { type: "film", watched_at: null })).toBe(true);
  });
});

describe("goalWouldCount — 'if I mark it watched NOW'", () => {
  it("counts for this year's goal and not for last year's", () => {
    expect(goalWouldCount(goal(), "film")).toBe(true);
    expect(goalWouldCount(goal({ metric_year: 2025 }), "film")).toBe(false);
  });
  it("still applies the type rule", () => {
    expect(goalWouldCount(goal(), "anime")).toBe(false);
    expect(goalWouldCount(goal({ metric_key: "anime" }), "anime")).toBe(true);
  });
  it("an all-time goal always would", () => {
    expect(goalWouldCount(goal({ metric_period: null, metric_year: null }), "serie")).toBe(false); // wrong type
    expect(goalWouldCount(goal({ metric_key: "titles", metric_period: null, metric_year: null }), "serie")).toBe(true);
  });
});

describe("goalMetricLabel", () => {
  it("names the unit the way the UI says it", () => {
    expect(goalMetricLabel(goal({ metric_key: "films" }))).toBe("films");
    expect(goalMetricLabel(goal({ metric_key: "series" }))).toBe("TV shows");
    expect(goalMetricLabel(goal({ metric_key: "anime" }))).toBe("animes");
    expect(goalMetricLabel(goal({ metric_key: "titles" }))).toBe("titles");
    expect(goalMetricLabel(goal({ metric_key: null }))).toBe("titles");
  });
});
