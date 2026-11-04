import { describe, expect, it } from "vitest";
import { activityBucket } from "./series-state";

const knight = { type: "serie", status: "ended", in_progress: true, watched: false,
  current_season: 1, current_episode: 6, season_aired: [6], season_episodes: [6] };

describe("derived activity classification", () => {
  it("places the real completed Knight S1E6 in Last Watched despite stale posture", () => {
    expect(activityBucket(knight)).toBe("last-watched");
  });
  it("keeps a finished season waiting for renewal out of In Progress", () => {
    expect(activityBucket({ ...knight, status: "returning series", season_episodes: [6, 6], season_aired: [6, 0] })).toBe("last-watched");
  });
  it("keeps weekly followers and behind viewers in In Progress", () => {
    expect(activityBucket({ ...knight, status: "returning series", season_episodes: [8] })).toBe("in-progress");
    expect(activityBucket({ ...knight, current_episode: 5 })).toBe("in-progress");
  });
  it("does not treat a stale completed claim as an intention to resume", () => {
    expect(activityBucket({ ...knight, type: "anime", watched: true, in_progress: false, season_aired: [7], season_episodes: [8] })).toBe("last-watched");
  });
  it("preserves explicit paused/dropped states and does not promote unstarted titles", () => {
    expect(activityBucket({ ...knight, paused: true })).toBeNull();
    expect(activityBucket({ ...knight, dropped: true })).toBeNull();
    expect(activityBucket({ ...knight, in_progress: false })).toBeNull();
  });
  it("preserves film and unknown-catalogue semantics", () => {
    expect(activityBucket({ ...knight, type: "film" })).toBe("in-progress");
    expect(activityBucket({ ...knight, type: "film", watched: true })).toBe("last-watched");
    expect(activityBucket({ ...knight, season_aired: [] })).toBe("in-progress");
    expect(activityBucket({ ...knight, season_aired: [], watched: true })).toBe("last-watched");
  });
});
