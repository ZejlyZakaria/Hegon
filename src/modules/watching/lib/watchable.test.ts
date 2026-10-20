import { describe, expect, it } from "vitest";
import { isWatchableNow } from "./watchable";
import { isAwaitingRelease } from "../utils";

const now = new Date("2026-10-13T12:00:00Z");
describe("isWatchableNow", () => {
  it("rejects an upcoming movie regardless of library membership or provider label", () => {
    for (const want_to_watch of [false, true]) {
      const movie = { type: "film", release_date: "2027-12-01", status: "Released", want_to_watch };
      expect(isWatchableNow(movie, now)).toBe(false);
      expect(isAwaitingRelease(movie)).toBe(true);
    }
  });
  it("allows released films, including their release day", () => {
    expect(isWatchableNow({ type: "film", release_date: "2026-10-13" }, now)).toBe(true);
  });
  it.each(["serie", "anime"])("requires aired content for %s when counts are known", (type) => {
    expect(isWatchableNow({ type, season_aired: [0], season_air_dates: ["2020-01-01"], year: 2020 }, now)).toBe(false);
    expect(isWatchableNow({ type, season_aired: [0, 1] }, now)).toBe(true);
    expect(isWatchableNow({ type, season_aired: [] }, now)).toBe(false);
  });
  it.each(["serie", "anime"])("uses premiere evidence for unknown %s airing counts", (type) => {
    expect(isWatchableNow({ type, season_aired: null }, now)).toBe(false);
    expect(isWatchableNow({ type, first_air_date: "2027-01-01" }, now)).toBe(false);
    expect(isWatchableNow({ type, first_air_date: "2020-01-01" }, now)).toBe(true);
    expect(isWatchableNow({ type, season_air_dates: ["2020-01-01"] }, now)).toBe(true);
    expect(isWatchableNow({ type, year: 2020 }, now)).toBe(true);
    expect(isWatchableNow({ type, year: 2026 }, now)).toBe(false);
    expect(isWatchableNow({ type, current_episode: 2 }, now)).toBe(true);
  });
  it("does not use lifecycle labels or announcements as proof", () => {
    expect(isWatchableNow({ type: "film" }, now)).toBe(false);
    expect(isWatchableNow({ type: "film", release_date: "invalid" }, now)).toBe(false);
    expect(isWatchableNow({ type: "film", year: 2020 }, now)).toBe(true);
  });
});
