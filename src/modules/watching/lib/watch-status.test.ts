import { describe, expect, it } from "vitest";
import {
  canComplete,
  claimedStatus,
  deriveWatchStatus,
  markCaughtUpPatch,
  markWatchedPatch,
  positionPatch,
  type StatusFacts,
} from "./watch-status";

// Real rows. Invented cases prove invented things.

// House of the Dragon: TMDB announces 3 seasons ([10,8,8]); only 3 episodes of S3 exist.
const hotd = (over: Partial<StatusFacts> = {}): StatusFacts => ({
  type: "serie",
  status: "ongoing",
  watched: false,
  in_progress: true,
  paused: false,
  dropped: false,
  favorite: false,
  season_episodes: [10, 8, 8],
  season_aired: [10, 8, 3],
  season_years: { "1": 2022, "2": 2024 },
  current_season: 3,
  current_episode: 1,
  caught_up_at: null,
  ...over,
});

// Seven Deadly Sins: four seasons, finished, and you saw three of them — years ago.
const sds = (over: Partial<StatusFacts> = {}): StatusFacts => ({
  type: "anime",
  status: "ended",
  watched: true,
  in_progress: false,
  paused: false,
  dropped: false,
  favorite: false,
  season_episodes: [24, 24, 24, 24],
  season_aired: [24, 24, 24, 24],
  season_years: {},
  current_season: 4,
  current_episode: 24,
  caught_up_at: null,
  ...over,
});

describe("deriveWatchStatus — ONE priority order", () => {
  // The bug: the service read the stances first, the StatusCard read `watched` first, under a
  // comment claiming they matched. A row with both flags said "Watched" on one screen and
  // "Dropped" on the next.
  it("lets a stance outrank a stale `watched` flag — the same way, everywhere", () => {
    expect(deriveWatchStatus({ watched: true, dropped: true })).toBe("dropped");
    expect(deriveWatchStatus({ watched: true, paused: true })).toBe("paused");
  });

  it("still completes a clean row", () => {
    expect(deriveWatchStatus({ watched: true })).toBe("completed");
    expect(deriveWatchStatus({ in_progress: true })).toBe("watching");
    expect(deriveWatchStatus({})).toBe("plan_to_watch");
    expect(deriveWatchStatus({ is_reference: true, watched: true })).toBe("reference");
  });
});

describe("canComplete — you cannot finish a story that is still being told", () => {
  it("refuses a running series", () => {
    expect(canComplete(hotd())).toBe(false);
  });
  it("allows a finished one", () => {
    expect(canComplete(hotd({ status: "ended" }))).toBe(true);
  });

  // A FILM must have been RELEASED — the person pages list unreleased credits under "Not seen yet",
  // and nothing used to stop you claiming to have watched a film that does not exist.
  it("refuses an unreleased film (TMDB status)", () => {
    expect(canComplete({ type: "film", status: "post production" })).toBe(false);
    expect(canComplete({ type: "film", status: "planned" })).toBe(false);
    expect(canComplete({ type: "film", status: "canceled" })).toBe(false);
  });
  it("refuses a film whose release YEAR is still ahead (legacy row, no status)", () => {
    expect(canComplete({ type: "film", status: null, year: new Date().getFullYear() + 1 })).toBe(false);
  });
  it("allows a released film, and stays permissive when nothing is known", () => {
    expect(canComplete({ type: "film", status: "released" })).toBe(true);
    expect(canComplete({ type: "film", status: null })).toBe(true);      // legacy, no future year → don't block on ignorance
    expect(canComplete({ type: "film", status: undefined })).toBe(true);
  });
});

describe("markWatchedPatch — the claim travels with its evidence", () => {
  const patch = markWatchedPatch(sds({ watched: false, current_season: 2, current_episode: 5 }));

  it("MOVES you to the last aired episode", () => {
    // The 23 ghost rows were `watched: true` with a null position: watchedCount() read them as
    // zero episodes seen, so Quick Stats printed "0 / 96" under the word "Watched".
    expect(patch.current_season).toBe(4);
    expect(patch.current_episode).toBe(24);
  });

  it("recomputes caught_up_at rather than leaving it to chance", () => {
    expect(patch.caught_up_at).toMatch(/^\d{4}-/);
  });

  it("stamps only seasons that FULLY AIRED", () => {
    // House of the Dragon's season 3 has four of its eight episodes out. Stamping every ANNOUNCED
    // season put "2026" on it.
    const p = markWatchedPatch(hotd({ season_years: {} }));
    expect(Object.keys(p.season_years ?? {})).toEqual(["1", "2"]);
  });

  it("never merges into an unloaded season_years — that would WIPE the column", () => {
    // stampSeasons MERGES. Merging into `undefined` and writing the result replaces the whole jsonb
    // with one entry, destroying every year set by hand.
    const p = markWatchedPatch(sds({ watched: false, season_years: undefined }));
    expect("season_years" in p).toBe(false);
  });
});

describe("markCaughtUpPatch — the word the app never had", () => {
  const patch = markCaughtUpPatch(hotd())!;

  it("lands you at the last AIRED episode, not the last announced one", () => {
    expect(patch.current_season).toBe(3);
    expect(patch.current_episode).toBe(3);   // not 8
  });

  it("does NOT call it watched", () => {
    expect(patch.watched).toBe(false);
    expect(patch.in_progress).toBe(true);
  });

  it("stamps caught_up_at — which is what lights the card up as NEW later", () => {
    expect(patch.caught_up_at).toMatch(/^\d{4}-/);
  });

  it("refuses to guess with no airing data", () => {
    expect(markCaughtUpPatch(hotd({ season_aired: [] }))).toBeNull();
  });
});

// The FOURTH door — and it stayed open under a comment declaring the doors shut. `update:topTen`
// wrote `watched: true` unconditionally, so ranking House of the Dragon in your Top 10 declared a
// running show finished. Loving something is not having seen the end of it.
describe("claimedStatus — one derivation, for every door", () => {
  it("a claim of NOTHING changes nothing", () => {
    expect(claimedStatus(hotd(), null)).toBeNull();
  });

  it("caught up on a running show is not watched", () => {
    const p = claimedStatus(hotd(), { season: 3, episode: 3 })!;
    expect(p.watched).toBe(false);
    expect(p.in_progress).toBe(true);
    expect(p.caught_up_at).toMatch(/^\d{4}-/);
  });

  it("stopping partway is paused or dropped — never 'in progress'", () => {
    // "In Progress" means you are watching it NOW. A show you left three seasons in, in 2018, isn't.
    const p = claimedStatus(sds({ watched: false }), { season: 3, episode: 24 }, "dropped")!;
    expect(p.dropped).toBe(true);
    expect(p.in_progress).toBe(false);
    expect(p.watched).toBe(false);
  });

  it("but being CAUGHT UP is not stopping partway — there is nothing left to watch", () => {
    const p = claimedStatus(hotd(), { season: 3, episode: 3 }, "dropped")!;
    expect(p.dropped).toBe(false);
    expect(p.in_progress).toBe(true);
  });

  it("only a finished show, seen through, is watched", () => {
    const p = claimedStatus(sds({ watched: false }), { season: 4, episode: 24 })!;
    expect(p.watched).toBe(true);
    expect(p.watched_at).toMatch(/^\d{4}-/);
  });
});

describe("positionPatch — a viewing is not a correction", () => {
  it("a VIEWING dates the move and stamps the season it just crossed", () => {
    const p = positionPatch(hotd({ current_season: 1, current_episode: 10, season_years: {} }), 2, 1, "viewing");
    expect(p.last_watched_at).toMatch(/^\d{4}-/);
    expect(p.season_years).toEqual({ "1": new Date().getFullYear() });
  });

  it("a CORRECTION stamps nothing and dates nothing", () => {
    // "I watched through season 3" of a show you left in 2018 does not mean you watched it TODAY.
    const p = positionPatch(sds(), 3, 24, "correction");
    expect(p.last_watched_at).toBeUndefined();
    expect(p.season_years).toBeUndefined();
  });

  it("a correction REVOKES a completion it contradicts", () => {
    // Seven Deadly Sins: marked watched (the only word on offer), but you saw three of four seasons.
    const p = positionPatch(sds(), 3, 24, "correction");
    expect(p.watched).toBe(false);
    expect(p.in_progress).toBe(true);
  });

  it("...and leaves a stance you chose alone", () => {
    const p = positionPatch(sds({ dropped: true }), 3, 24, "correction");
    expect(p.watched).toBe(false);
    expect(p.in_progress).toBe(false);   // you dropped it; moving the marker isn't changing your mind
  });

  it("a correction that lands on the end of a FINISHED show completes it", () => {
    const p = positionPatch(sds({ watched: false, current_season: 3, current_episode: 24 }), 4, 24, "correction");
    expect(p.watched).toBe(true);
    expect(p.watched_at).toMatch(/^\d{4}-/);
  });

  it("but a VIEWING never claims completion — finishing is its own deliberate act", () => {
    const p = positionPatch(sds({ watched: false, current_season: 4, current_episode: 23 }), 4, 24, "viewing");
    expect(p.watched).toBeUndefined();
  });

  it("EVERY position write recomputes caught_up_at — including the Undo that used to skip it", () => {
    // Tap "+1" to the frontier → stamped. Undo → you are behind again, and the stamp must go, or
    // the next episode to air announces itself as "New" to someone who was never caught up.
    const atFrontier = positionPatch(hotd(), 3, 3, "viewing");
    expect(atFrontier.caught_up_at).toMatch(/^\d{4}-/);

    const undone = positionPatch(hotd({ current_season: 3, current_episode: 3, caught_up_at: "2026-01-01T00:00:00Z" }), 3, 2, "correction");
    expect(undone.caught_up_at).toBeNull();
  });
});
