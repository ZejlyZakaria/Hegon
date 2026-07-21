import { describe, expect, it } from "vitest";
import {
  airedCount,
  airedFromTmdb,
  caughtUpAt,
  isEpisodeActionable,
  isSeasonComplete,
  isSeasonDatable,
  isSeasonLive,
  lastWatched,
  lastAiredPosition,
  nextStep,
  reachedEntries,
  seriesState,
  watchedCount,
} from "./series-state";

// Every fixture below is a REAL row from the library. Invented cases prove invented things.

// House of the Dragon: TMDB announces 3 seasons ([10,8,8]), but only 3 episodes of S3 are out.
const hotd = (season: number, episode: number, caught_up_at: string | null = null) => ({
  season_episodes: [10, 8, 8],
  season_aired: [10, 8, 3],
  status: "ongoing",
  current_season: season,
  current_episode: episode,
  caught_up_at,
});

// The Boys: finished in the world, still `ongoing` in our snapshot until the sync runs.
const theBoys = (status: string) => ({
  season_episodes: [8, 8, 8, 8, 8],
  season_aired: [8, 8, 8, 8, 8],
  status,
  current_season: 5,
  current_episode: 8,
});

// The Gentlemen: an announced season with ZERO episodes. Not a destination.
const gentlemen = {
  season_episodes: [8, 0],
  season_aired: [8, 0],
  status: "ongoing",
  current_season: 1,
  current_episode: 8,
};

describe("seriesState", () => {
  it("is watching while you're behind what aired", () => {
    expect(seriesState(hotd(3, 1))).toBe("watching");
  });

  it("is caught-up at the last AIRED episode of a show that isn't over", () => {
    // S3 E3 is the last thing that exists. Announced E4-E8 don't count.
    expect(seriesState(hotd(3, 3))).toBe("caught-up");
  });

  it("is completed only when the show is over AND you've seen it all", () => {
    expect(seriesState(theBoys("ongoing"))).toBe("caught-up");   // before the sync
    expect(seriesState(theBoys("ended"))).toBe("completed");     // the day TMDB flips it
  });

  it("treats a CANCELLED show as finished — no episode is ever coming", () => {
    expect(seriesState(theBoys("canceled"))).toBe("completed");
  });

  it("lights up as NEW when you were caught up and something has since aired", () => {
    // You stopped at S3 E3 and were caught up. The sync then found E4.
    const withE4 = { ...hotd(3, 3, "2026-01-01T00:00:00Z"), season_aired: [10, 8, 4] };
    expect(seriesState(withE4)).toBe("new");
  });

  it("refuses to answer without airing data", () => {
    expect(seriesState({ season_aired: [], status: "ended" })).toBeNull();
    expect(seriesState({ season_aired: null, status: "ended" })).toBeNull();
  });

  it("survives a stale position claiming more episodes than aired", () => {
    // A row that says S3 E8 while only 3 have aired must not report 5 phantom episodes.
    expect(watchedCount(hotd(3, 8))).toBe(21);   // 10 + 8 + 3, not 10 + 8 + 8
    expect(seriesState(hotd(3, 8))).toBe("caught-up");
  });
});

// The "Now" badge. The two failing cases below sat one line apart in the old rule
// (`current_episode < aired`) — one of them right, one of them wrong, for the same reason.
describe("isSeasonLive", () => {
  it("stays lit on a season still coming out, even when you've seen every aired episode", () => {
    // THE BUG. House of the Dragon: 3 of 8 episodes exist, you've watched all 3. Nothing is left
    // to watch, so the old rule said "not now" and dropped the badge — while you sit waiting for
    // Sunday, which is the most "now" a viewer ever is.
    expect(isSeasonLive(hotd(3, 3), 3)).toBe(true);
  });

  it("stays lit while you're simply behind", () => {
    expect(isSeasonLive(hotd(3, 1), 3)).toBe(true);
  });

  it("goes dark once the season you're caught up on has FINISHED airing", () => {
    // The case the old rule was written for, and it must keep working: every episode of season 5
    // exists and you've seen them all. You aren't watching it now — you're waiting for season 6.
    expect(isSeasonLive(theBoys("ongoing"), 5)).toBe(false);
  });

  it("stays lit mid-way through a season that has fully aired", () => {
    // Season 2 is complete (8 of 8) and you're at episode 4. Still watching it, plainly.
    expect(isSeasonLive(hotd(2, 4), 2)).toBe(true);
  });

  it("is only ever true of the season you're standing in", () => {
    expect(isSeasonLive(hotd(3, 3), 1)).toBe(false);
    expect(isSeasonLive(hotd(3, 3), 2)).toBe(false);
  });

  it("is false for a season nothing has aired from — that's 'coming soon', not 'now'", () => {
    expect(isSeasonLive({ ...gentlemen, current_season: 2, current_episode: 0 }, 2)).toBe(false);
  });
});

describe("nextStep — you cannot watch an episode that does not exist", () => {
  it("advances inside a season", () => {
    expect(nextStep(hotd(3, 1))).toEqual({ kind: "episode", season: 3, episode: 2 });
  });

  it("rolls into the next season", () => {
    expect(nextStep(hotd(1, 10))).toEqual({ kind: "season", season: 2, episode: 1 });
  });

  it("STOPS at the last aired episode of an ongoing show", () => {
    // The whole point: +1 must not offer E4 of a season that has aired 3.
    expect(nextStep(hotd(3, 3))).toEqual({ kind: "caught-up" });
  });

  it("offers Finish only when the show is really over", () => {
    expect(nextStep(theBoys("ongoing"))).toEqual({ kind: "caught-up" });
    expect(nextStep(theBoys("ended"))).toEqual({ kind: "finish" });
  });

  it("never rolls into an announced season with zero episodes", () => {
    expect(nextStep(gentlemen)).toEqual({ kind: "caught-up" });
  });

  it("skips a zero-episode season to reach one that has aired", () => {
    const m = { season_aired: [8, 0, 6], season_episodes: [8, 0, 6], status: "ongoing", current_season: 1, current_episode: 8 };
    expect(nextStep(m)).toEqual({ kind: "season", season: 3, episode: 1 });
  });

  it("refuses to answer without airing data", () => {
    expect(nextStep({ season_aired: [], status: "ended" })).toBeNull();
  });
});

describe("isEpisodeActionable — you may only score what aired AND what you reached", () => {
  it("allows everything behind your position", () => {
    expect(isEpisodeActionable(hotd(3, 3), 1, 5)).toBe(true);    // a season you finished
    expect(isEpisodeActionable(hotd(3, 3), 3, 3)).toBe(true);    // where you stand
  });

  it("locks the announced-but-unaired ones", () => {
    expect(isEpisodeActionable(hotd(3, 3), 3, 5)).toBe(false);   // announced, not out
    expect(isEpisodeActionable(hotd(3, 3), 3, 8)).toBe(false);
  });

  // True Detective: 4 seasons, you watched only the first. Watch History locks seasons 2-4 —
  // but the episode rail let you star any episode inside them. Same door, one side left open.
  const trueDetective = {
    season_episodes: [8, 8, 8, 6],
    season_aired: [8, 8, 8, 6],
    status: "ongoing",
    current_season: 1,
    current_episode: 8,
    watched: false,
  };

  it("locks an AIRED episode you haven't reached yet", () => {
    expect(isEpisodeActionable(trueDetective, 1, 8)).toBe(true);    // season you watched
    expect(isEpisodeActionable(trueDetective, 2, 1)).toBe(false);   // aired, never watched
    expect(isEpisodeActionable(trueDetective, 4, 6)).toBe(false);
  });

  it("opens everything once you've finished the show", () => {
    const done = { ...trueDetective, status: "ended", watched: true, current_season: 1, current_episode: 8 };
    expect(isEpisodeActionable(done, 4, 6)).toBe(true);
  });

  it("locks anything outside the seasons we know", () => {
    expect(isEpisodeActionable(hotd(3, 3), 4, 1)).toBe(false);
    expect(isEpisodeActionable(hotd(3, 3), 3, 0)).toBe(false);
  });
});

// One-Punch Man: you watched seasons 1 (2017) and 2 (2019), then mis-set your position to
// season 1. The 2019 stamp stayed, and "Last watched" kept reading 2019 for a season you were
// no longer claiming.
describe("reachedEntries — a stamp only counts for a season you have reached", () => {
  const opm = (season: number) => ({
    season_episodes: [12, 12, 12],
    season_aired: [12, 12, 12],
    status: "ongoing",
    current_season: season,
    current_episode: 12,
    watched: false,
  });
  const years = { "1": 2017, "2": 2019 };

  it("ignores the stamp of a season you haven't reached", () => {
    expect(reachedEntries(opm(1), years)).toEqual([2017]);
  });

  it("brings it back the moment you advance — the data was never destroyed", () => {
    expect(reachedEntries(opm(2), years)).toEqual([2017, 2019]);
  });

  it("honours everything once the show is finished", () => {
    expect(reachedEntries({ ...opm(1), watched: true }, years)).toEqual([2017, 2019]);
  });

  it("survives an empty map", () => {
    expect(reachedEntries(opm(1), null)).toEqual([]);
  });
});

// The two bugs the owner caught on screen, side by side. They look unrelated; they're the same
// question asked twice — "which source actually knows?"
describe("lastWatched — a finished season's year beats a click timestamp", () => {
  it("One-Punch Man: correcting your position with the stepper must not claim you watched it today", () => {
    // You watched S1 in 2017 and S2 in 2019. Fixing the position TODAY is a forward move, so it
    // stamped last_watched_at with today's date — and the panel proudly said "13 Jul 2026".
    const opm = {
      season_aired: [12, 12, 12],
      season_episodes: [12, 12, 12],
      status: "ongoing",
      current_season: 2,
      current_episode: 12,
      season_years: { "1": 2017, "2": 2019 },
      last_watched_at: "2026-07-13T10:00:00Z",
      watched: false,
    };
    expect(lastWatched(opm)).toEqual({ kind: "year", value: 2019 });
  });

  it("House of the Dragon: mid-season, only the timestamp knows", () => {
    // Season 3 has no year (it hasn't ended), so the click is the only record of last week.
    const hotdLive = {
      season_aired: [10, 8, 4],
      season_episodes: [10, 8, 8],
      status: "ongoing",
      current_season: 3,
      current_episode: 4,
      season_years: { "1": 2022, "2": 2024 },
      last_watched_at: "2026-07-13T10:00:00Z",
      watched: false,
    };
    expect(lastWatched(hotdLive)).toEqual({ kind: "date", value: "2026-07-13T10:00:00Z" });
  });

  it("falls back to the reached years when no timestamp was ever captured", () => {
    expect(lastWatched({
      season_aired: [12, 12], season_episodes: [12, 12], current_season: 2, current_episode: 12,
      season_years: { "1": 2017, "2": 2019 }, watched: false,
    })).toEqual({ kind: "year", value: 2019 });
  });

  it("says nothing rather than invent something", () => {
    expect(lastWatched({ season_aired: [12], current_season: 1, current_episode: 0 })).toBeNull();
  });
});

describe("hasReachedSeason — ONE rule, not two", () => {
  // At S1 E0 the Watch History showed the 2017 badge (its rule: season <= position) while Quick
  // Stats ignored it (its rule: at least one episode watched) and fell back on a stale 2019.
  const opm = { season_aired: [12, 12, 12], current_season: 1, current_episode: 0, watched: false };

  it("honours the season you are IN, even at episode 0", () => {
    expect(reachedEntries(opm, { "1": 2017, "2": 2019 })).toEqual([2017]);
  });
});

describe("airedFromTmdb — a title is born knowing what exists", () => {
  const seasons = [
    { season_number: 0, episode_count: 4 },   // Specials — never counted
    { season_number: 1, episode_count: 10 },
    { season_number: 2, episode_count: 8 },
    { season_number: 3, episode_count: 8 },
  ];

  it("reads TMDB's own frontier: House of the Dragon is at S3 E4", () => {
    expect(airedFromTmdb(seasons, { season_number: 3, episode_number: 4 })).toEqual([10, 8, 4]);
  });

  it("a show that hasn't started has nothing aired", () => {
    expect(airedFromTmdb(seasons, null)).toEqual([0, 0, 0]);
  });

  it("a finished show has everything aired", () => {
    expect(airedFromTmdb(seasons, { season_number: 3, episode_number: 8 })).toEqual([10, 8, 8]);
  });

  it("ignores season order and Specials", () => {
    const shuffled = [
      { season_number: 2, episode_count: 8 },
      { season_number: 0, episode_count: 4 },
      { season_number: 1, episode_count: 10 },
    ];
    expect(airedFromTmdb(shuffled, { season_number: 2, episode_number: 3 })).toEqual([10, 3]);
  });
});

// The side doors. Every one of these was open while the front door was bolted shut.
describe("isSeasonDatable — a year is a fact about a FINISHED season", () => {
  it("refuses the season still coming out — this is what `Set all year` was stamping", () => {
    // House of the Dragon: you're caught up at S3 E3, but season 3 announces 8 episodes.
    expect(isSeasonDatable(hotd(3, 3), 1)).toBe(true);
    expect(isSeasonDatable(hotd(3, 3), 2)).toBe(true);
    expect(isSeasonDatable(hotd(3, 3), 3)).toBe(false);   // 3 of 8 aired
  });

  it("refuses a season you haven't finished, even fully aired", () => {
    const from = { season_episodes: [10, 10, 10], season_aired: [10, 10, 10], status: "ongoing", current_season: 2, current_episode: 4, watched: false };
    expect(isSeasonDatable(from, 2)).toBe(false);   // you're 4 episodes in
    expect(isSeasonDatable(from, 3)).toBe(false);   // never reached
  });

  it("ACCEPTS the season you're standing at the end of — the old rule got this wrong", () => {
    // FROM: you finished season 4 and are waiting on season 5. The strip's private rule ("is it
    // BEHIND my position") called it undatable, so you couldn't date the season you'd just watched.
    const from = { season_episodes: [10, 10, 10, 10], season_aired: [10, 10, 10, 10], status: "ongoing", current_season: 4, current_episode: 10, watched: false };
    expect(isSeasonDatable(from, 4)).toBe(true);
  });

  it("opens every aired season once the show is watched", () => {
    expect(isSeasonDatable({ ...theBoys("ended"), watched: true }, 1)).toBe(true);
  });
});

describe("caughtUpAt — the stamp that lets a title light up later", () => {
  it("is set the moment you reach the frontier", () => {
    expect(caughtUpAt(hotd(3, 3), null)).toMatch(/^\d{4}-/);
  });

  it("keeps the ORIGINAL stamp — it marks when you got there, not when you last looked", () => {
    expect(caughtUpAt(hotd(3, 3), "2026-01-01T00:00:00Z")).toBe("2026-01-01T00:00:00Z");
  });

  it("is null while you're still behind", () => {
    expect(caughtUpAt(hotd(2, 4), null)).toBeNull();
  });

  it("clears when you step BACK — walking away from the frontier is not news", () => {
    expect(caughtUpAt(hotd(1, 2), "2026-01-01T00:00:00Z")).toBeNull();
  });

  it("survives a finished show: seen it all, and it's over", () => {
    expect(caughtUpAt(theBoys("ended"), null)).toMatch(/^\d{4}-/);
  });
});

describe("the rest", () => {
  it("counts what aired", () => {
    expect(airedCount(hotd(1, 1))).toBe(21);
  });

  it("finds the last position that exists in the world", () => {
    expect(lastAiredPosition(hotd(1, 1))).toEqual({ season: 3, episode: 3 });
    expect(lastAiredPosition(gentlemen)).toEqual({ season: 1, episode: 8 });   // skips the empty S2
    expect(lastAiredPosition({ season_aired: [] })).toBeNull();
  });

  it("only calls a season complete when it has FULLY aired", () => {
    expect(isSeasonComplete(hotd(1, 1), 1)).toBe(true);    // 10/10 aired
    expect(isSeasonComplete(hotd(1, 1), 3)).toBe(false);   // 3/8 aired — its year must not be stamped
  });
});
