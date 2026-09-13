import { describe, expect, it } from "vitest";
import { formatPosition, overallProgress } from "./progress";

// The carousel's bar measures against what has AIRED, not what is ANNOUNCED — a decision recorded
// in the module and, until now, only in the module.

describe("overallProgress — how far through WHAT EXISTS", () => {
  it("is 100 when you are caught up on an unfinished show, even with more announced", () => {
    // 3 seasons announced (10, 10, 10), only 25 aired, you are at S3 E5 → 25/25.
    expect(overallProgress({ season_aired: [10, 10, 5], season_episodes: [10, 10, 10], current_season: 3, current_episode: 5 })).toBe(100);
  });
  it("counts every season behind you plus your place in the current one", () => {
    expect(overallProgress({ season_aired: [10, 10, 10], current_season: 2, current_episode: 5 })).toBe(50);
  });
  it("clamps a stale position that claims more than has aired", () => {
    expect(overallProgress({ season_aired: [10, 4], current_season: 2, current_episode: 9 })).toBe(100);
  });
  it("is 0 with no airing data — the caller degrades, it does not guess", () => {
    expect(overallProgress({ season_aired: null, current_season: 3, current_episode: 4 })).toBe(0);
    expect(overallProgress({ season_aired: [], current_season: 1, current_episode: 0 })).toBe(0);
  });
  it("rounds to a whole percent", () => {
    expect(overallProgress({ season_aired: [3], current_season: 1, current_episode: 1 })).toBe(33);
    expect(overallProgress({ season_aired: [3], current_season: 1, current_episode: 2 })).toBe(67);
  });
});

describe("formatPosition", () => {
  it("zero-pads both numbers so a column lines up", () => {
    expect(formatPosition(3, 4)).toBe("S03 E04");
    expect(formatPosition(12, 120)).toBe("S12 E120");
    expect(formatPosition(1, 0)).toBe("S01 E00");
  });
});
