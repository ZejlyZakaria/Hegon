import { describe, expect, it } from "vitest";
import { episodesLeftInSeason, nextEpisode } from "./progress";

// A 3-season show: 10, 8, 6 episodes.
const show = (season: number, episode: number) => ({
  season_episodes: [10, 8, 6],
  current_season: season,
  current_episode: episode,
});

describe("nextEpisode", () => {
  it("advances inside a season", () => {
    expect(nextEpisode(show(1, 3))).toEqual({ kind: "episode", season: 1, episode: 4 });
  });

  it("rolls into the next season on the last episode", () => {
    expect(nextEpisode(show(1, 10))).toEqual({ kind: "season", season: 2, episode: 1 });
    expect(nextEpisode(show(2, 8))).toEqual({ kind: "season", season: 3, episode: 1 });
  });

  it("reports the finale on the last episode of the last season", () => {
    expect(nextEpisode(show(3, 6))).toEqual({ kind: "finale" });
  });

  it("handles a show you haven't started (episode 0)", () => {
    expect(nextEpisode(show(1, 0))).toEqual({ kind: "episode", season: 1, episode: 1 });
  });

  it("refuses to guess without episode data", () => {
    expect(nextEpisode({ season_episodes: [], current_season: 1, current_episode: 2 })).toBeNull();
    expect(nextEpisode({ season_episodes: null, current_season: 1, current_episode: 2 })).toBeNull();
  });

  it("refuses to guess when the position is past the data we hold", () => {
    // TMDB says 3 seasons, the row claims season 4: don't invent a season 5.
    expect(nextEpisode(show(4, 1))).toBeNull();
  });

  it("skips a season TMDB reports as empty rather than rolling into nothing", () => {
    // A trailing 0-episode season (an announced-but-unaired one) is not a place to go.
    expect(nextEpisode({ season_episodes: [10, 0], current_season: 1, current_episode: 10 }))
      .toEqual({ kind: "finale" });
  });
});

describe("episodesLeftInSeason", () => {
  it("counts what's left where you are", () => {
    expect(episodesLeftInSeason(show(2, 3))).toBe(5);
    expect(episodesLeftInSeason(show(2, 8))).toBe(0);
  });

  it("returns null when it can't know", () => {
    expect(episodesLeftInSeason({ season_episodes: [], current_season: 1, current_episode: 0 })).toBeNull();
  });
});
