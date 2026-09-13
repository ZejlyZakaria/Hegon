import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { displayTitle, isAwaitingRelease, releaseCountdown, watchedAgo } from "./utils";

// Three date predicates and one script test, all read on every grid page, none tested. Each has a
// threshold table in its body; a threshold table is exactly what silently drifts when someone
// "just tweaks" a copy. The clock is frozen so "days ago" is deterministic.

const NOW = new Date("2026-09-13T12:00:00Z");
const daysFromNow = (n: number) => new Date(NOW.getTime() + n * 86_400_000).toISOString();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

describe("watchedAgo — relative, and never about the future", () => {
  it("says nothing when there is nothing honest to say", () => {
    expect(watchedAgo(null)).toBeNull();
    expect(watchedAgo(undefined)).toBeNull();
    expect(watchedAgo("not a date")).toBeNull();
    // A film dated by year stamps Dec 31 — ahead of us for the current year. We don't claim it.
    expect(watchedAgo("2026-12-31T00:00:00Z")).toBeNull();
  });

  it("walks the long-form thresholds", () => {
    expect(watchedAgo(daysFromNow(0))).toBe("Today");
    expect(watchedAgo(daysFromNow(-1))).toBe("Yesterday");
    expect(watchedAgo(daysFromNow(-6))).toBe("6 days ago");
    expect(watchedAgo(daysFromNow(-7))).toBe("Last week");
    expect(watchedAgo(daysFromNow(-13))).toBe("Last week");
    expect(watchedAgo(daysFromNow(-14))).toBe("2 weeks ago");
    expect(watchedAgo(daysFromNow(-29))).toBe("4 weeks ago");
    expect(watchedAgo(daysFromNow(-30))).toBe("Last month");
    expect(watchedAgo(daysFromNow(-59))).toBe("Last month");
    expect(watchedAgo(daysFromNow(-60))).toBe("2 months ago");
    expect(watchedAgo(daysFromNow(-364))).toBe("12 months ago");
    expect(watchedAgo(daysFromNow(-365))).toBe("Last year");
    expect(watchedAgo(daysFromNow(-730))).toBe("2 years ago");
  });

  it("has a compact form for a narrow poster, on the same thresholds", () => {
    expect(watchedAgo(daysFromNow(0), { short: true })).toBe("Today");
    expect(watchedAgo(daysFromNow(-3), { short: true })).toBe("3d");
    expect(watchedAgo(daysFromNow(-13), { short: true })).toBe("1w");
    expect(watchedAgo(daysFromNow(-45), { short: true })).toBe("1mo");
    expect(watchedAgo(daysFromNow(-400), { short: true })).toBe("1y");
  });
});

describe("isAwaitingRelease — THE single 'is a film out?' predicate", () => {
  it("is never true for a series or an anime", () => {
    expect(isAwaitingRelease({ type: "serie", release_date: daysFromNow(30) })).toBe(false);
    expect(isAwaitingRelease({ type: "anime", status: "Planned" })).toBe(false);
  });

  it("trusts the stored release date first", () => {
    expect(isAwaitingRelease({ type: "film", release_date: daysFromNow(1) })).toBe(true);
    expect(isAwaitingRelease({ type: "film", release_date: daysFromNow(-1) })).toBe(false);
    // A date wins over a contradicting status snapshot.
    expect(isAwaitingRelease({ type: "film", release_date: daysFromNow(-1), status: "Post Production" })).toBe(false);
  });

  it("falls back to the TMDB status snapshot for legacy rows, case-insensitively", () => {
    expect(isAwaitingRelease({ type: "film", status: "Released" })).toBe(false);
    expect(isAwaitingRelease({ type: "film", status: "released" })).toBe(false);
    expect(isAwaitingRelease({ type: "film", status: "Post Production" })).toBe(true);
  });

  it("falls back to a coarse future-year guard when it knows nothing else", () => {
    expect(isAwaitingRelease({ type: "film", year: 2027 })).toBe(true);
    expect(isAwaitingRelease({ type: "film", year: 2026 })).toBe(false); // this year = assume out
    expect(isAwaitingRelease({ type: "film", year: null })).toBe(false);
    expect(isAwaitingRelease({ type: "film" })).toBe(false);
  });
});

describe("releaseCountdown — null when unknown or past, otherwise the way a person says it", () => {
  it("is null for a missing, invalid, or past date", () => {
    expect(releaseCountdown(null)).toBeNull();
    expect(releaseCountdown("nope")).toBeNull();
    expect(releaseCountdown(daysFromNow(-2))).toBeNull();
    expect(releaseCountdown(NOW.toISOString())).toBeNull(); // today is not "in" the future
  });

  it("walks the thresholds (ceil, so a few hours away is already 'Tomorrow')", () => {
    expect(releaseCountdown(daysFromNow(0.5))).toBe("Tomorrow");
    expect(releaseCountdown(daysFromNow(6))).toBe("6 days");
    expect(releaseCountdown(daysFromNow(7))).toBe("Next week");
    expect(releaseCountdown(daysFromNow(21))).toBe("3 weeks");
    expect(releaseCountdown(daysFromNow(45))).toBe("Next month");
    expect(releaseCountdown(daysFromNow(90))).toBe("3 months");
    expect(releaseCountdown(daysFromNow(400))).toBe("Next year");
    expect(releaseCountdown(daysFromNow(800))).toBe("2 years");
  });

  it("has a compact form", () => {
    expect(releaseCountdown(daysFromNow(3), { short: true })).toBe("3d");
    expect(releaseCountdown(daysFromNow(21), { short: true })).toBe("3w");
    expect(releaseCountdown(daysFromNow(90), { short: true })).toBe("3mo");
    expect(releaseCountdown(daysFromNow(800), { short: true })).toBe("2y");
  });
});

describe("displayTitle — original title when it is Latin, localized title otherwise", () => {
  it("prefers the original title for Latin scripts, accents included", () => {
    expect(displayTitle({ title: "Amelie", original_title: "Le Fabuleux Destin d'Amélie Poulain" })).toBe("Le Fabuleux Destin d'Amélie Poulain");
  });
  it("falls back to the localized title for CJK, Korean, Cyrillic…", () => {
    expect(displayTitle({ title: "Spirited Away", original_title: "千と千尋の神隠し" })).toBe("Spirited Away");
    expect(displayTitle({ title: "Parasite", original_title: "기생충" })).toBe("Parasite");
  });
  it("uses the title when there is no original title at all", () => {
    expect(displayTitle({ title: "Dune", original_title: null })).toBe("Dune");
  });
});
