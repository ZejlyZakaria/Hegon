import { describe, expect, it } from "vitest";
import { seasonRange, stampSeasons } from "./season-years";

// `stampSeasons` is the one function that decides whether an auto-stamp may touch a year — the
// ⭐⭐ "one writer of the watch year" rule lives on it (reference_watch_year_one_writer). It had a
// documented bug (a retracted claim re-dated with its stale year) and no test. Now it has both.

describe("stampSeasons — a set year is KEPT, an unset one is stamped", () => {
  it("never clobbers a season you dated by hand", () => {
    // Blue Lock: season 2 watched in 2019 (said so); finishing seasons 3-5 today must not touch it.
    expect(stampSeasons({ "2": 2019 }, [2, 3, 4, 5], 2026)).toEqual({ "2": 2019, "3": 2026, "4": 2026, "5": 2026 });
  });

  it("starts from nothing when there is no map yet", () => {
    expect(stampSeasons(null, [1], 2024)).toEqual({ "1": 2024 });
    expect(stampSeasons(undefined, [], 2024)).toEqual({});
  });

  it("returns a NEW object — the caller's map is never mutated", () => {
    const existing = { "1": 2020 };
    const next = stampSeasons(existing, [2], 2021);
    expect(existing).toEqual({ "1": 2020 });
    expect(next).not.toBe(existing);
  });
});

describe("stampSeasons — UNLESS the stamp is stale", () => {
  it("re-dates a season whose existing stamp is no longer claimed", () => {
    // Set S2 to 2025, moved back to "through S1", claimed S2 again in 2026: the 2025 was a leftover.
    const isStale = (s: number) => s === 2;
    expect(stampSeasons({ "1": 2024, "2": 2025 }, [2], 2026, isStale)).toEqual({ "1": 2024, "2": 2026 });
  });

  it("still protects the seasons you DO claim, even with a stale-check present", () => {
    const isStale = () => false;
    expect(stampSeasons({ "1": 2024, "2": 2025 }, [1, 2, 3], 2026, isStale)).toEqual({ "1": 2024, "2": 2025, "3": 2026 });
  });

  it("only asks the stale-check about seasons it is stamping", () => {
    const asked: number[] = [];
    stampSeasons({ "1": 2020, "2": 2021, "3": 2022 }, [2], 2026, (s) => { asked.push(s); return false; });
    expect(asked).toEqual([2]);
  });
});

describe("seasonRange", () => {
  it("is inclusive on both ends", () => {
    expect(seasonRange(2, 5)).toEqual([2, 3, 4, 5]);
    expect(seasonRange(3, 3)).toEqual([3]);
  });
  it("is empty when from > to — a stepper moved backwards stamps nothing", () => {
    expect(seasonRange(5, 2)).toEqual([]);
  });
});
