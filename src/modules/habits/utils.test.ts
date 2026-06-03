import { describe, it, expect } from "vitest";
import {
  computeStreak,
  streakWindowDays,
  getDaysAgoStr,
  getTodayStr,
  MAX_STREAK_WINDOW,
  type PausePeriod,
} from "./utils";

const daily = { frequency: "daily" as const, custom_days: null };

/** Build a completion Set from "days ago" offsets. */
function doneDaysAgo(...offsets: number[]): Set<string> {
  return new Set(offsets.map((n) => getDaysAgoStr(n)));
}

describe("computeStreak — basics", () => {
  it("returns zero for no completions", () => {
    expect(computeStreak(daily, new Set())).toEqual({ current: 0, best: 0 });
  });

  it("counts a consecutive run including today", () => {
    const { current, best } = computeStreak(daily, doneDaysAgo(0, 1, 2));
    expect(current).toBe(3);
    expect(best).toBe(3);
  });

  it("gives today grace when it is scheduled but not yet done", () => {
    // today pending, the three prior days done → streak survives.
    const { current } = computeStreak(daily, doneDaysAgo(1, 2, 3));
    expect(current).toBe(3);
  });

  it("a gap breaks the current run but best keeps the longest", () => {
    // done 1-3, gap at 4, done 5-9 (today pending).
    const completed = doneDaysAgo(1, 2, 3, 5, 6, 7, 8, 9);
    const { current, best } = computeStreak(daily, completed);
    expect(current).toBe(3);
    expect(best).toBe(5);
  });
});

describe("computeStreak — neutral days", () => {
  it("a skipped day bridges the streak instead of breaking it", () => {
    const completed = doneDaysAgo(0, 2); // day 1 missing
    const skipped = new Set([getDaysAgoStr(1)]);

    expect(computeStreak(daily, completed).current).toBe(1); // missing day breaks
    expect(computeStreak(daily, completed, { skipped }).current).toBe(2); // skip bridges
  });

  it("a pause period bridges the streak", () => {
    const completed = doneDaysAgo(0, 5);
    const pauses: PausePeriod[] = [{ start: getDaysAgoStr(4), end: getDaysAgoStr(1) }];
    expect(computeStreak(daily, completed, { pauses }).current).toBe(2);
  });
});

describe("computeStreak — scan window", () => {
  it("caps the streak at windowDays (the original bug)", () => {
    const completed = doneDaysAgo(0, 1, 2, 3);
    // A window of 2 can only see today + yesterday.
    expect(computeStreak(daily, completed, { windowDays: 2 }).current).toBe(2);
  });

  it("reports a true 100-day streak when the window is sized to the data", () => {
    const offsets = Array.from({ length: 100 }, (_, i) => i); // 0..99
    const completed = doneDaysAgo(...offsets);
    const window = streakWindowDays(getDaysAgoStr(99));

    expect(computeStreak(daily, completed, { windowDays: window }).best).toBe(100);
    // The old fixed 90-day window silently truncated it:
    expect(computeStreak(daily, completed, { windowDays: 90 }).best).toBe(90);
  });
});

describe("streakWindowDays", () => {
  it("sizes to the data extent plus a small buffer", () => {
    expect(streakWindowDays(getTodayStr(), getTodayStr())).toBe(2);
    expect(streakWindowDays(getDaysAgoStr(10), getTodayStr())).toBe(12);
  });

  it("is capped so an ancient date cannot blow up the scan", () => {
    expect(streakWindowDays("1900-01-01", getTodayStr())).toBe(MAX_STREAK_WINDOW);
  });
});
