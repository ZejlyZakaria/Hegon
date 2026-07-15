import { describe, expect, it } from "vitest";
import { buildWatchedAt, daysInMonth, partsFromISO } from "./watched-date";

const NOW = new Date("2026-07-15T10:00:00Z");

describe("daysInMonth — leap-aware", () => {
  it("knows the ordinary months", () => {
    expect(daysInMonth(2026, 1)).toBe(31);
    expect(daysInMonth(2026, 4)).toBe(30);
  });
  it("knows February in common and leap years", () => {
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2024, 2)).toBe(29);
  });
});

describe("buildWatchedAt — one honest construction rule", () => {
  it("keeps a full date to the day", () => {
    expect(buildWatchedAt({ year: 2024, month: 3, day: 9 }, NOW)).toBe("2024-03-09T12:00:00.000Z");
  });

  it("a month with no day → the 1st", () => {
    expect(buildWatchedAt({ year: 2024, month: 3, day: null }, NOW)).toBe("2024-03-01T12:00:00.000Z");
  });

  it("a PAST year alone → the end of that year, so it sorts last within it", () => {
    expect(buildWatchedAt({ year: 2020, month: null, day: null }, NOW)).toBe("2020-12-31T12:00:00.000Z");
  });

  it("the CURRENT year alone → now, NOT Dec 31 (which is still in the future)", () => {
    // Dec 31 2026 would sort above something watched last week and claim a date not yet reached.
    expect(buildWatchedAt({ year: 2026, month: null, day: null }, NOW)).toBe(NOW.toISOString());
  });

  it("never dates a viewing in the future, even if a day slips through", () => {
    // July 31 2026 is ahead of the 15th → clamped to now.
    expect(buildWatchedAt({ year: 2026, month: 7, day: 31 }, NOW)).toBe(NOW.toISOString());
  });
});

describe("partsFromISO — seeds the picker back", () => {
  it("round-trips a real date", () => {
    expect(partsFromISO("2024-03-09T12:00:00.000Z")).toEqual({ year: 2024, month: 3, day: 9 });
  });
  it("returns null for nothing", () => {
    expect(partsFromISO(null)).toBeNull();
    expect(partsFromISO("not a date")).toBeNull();
  });
});
