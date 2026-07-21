import { describe, expect, it } from "vitest";
import { insertMediaSchema, updateMediaSchema } from "../schemas/media.schema";
import {
  addStatusPatch,
  canComplete,
  claimedStatus,
  deriveWatchStatus,
  markCaughtUpPatch,
  markWatchedPatch,
  positionPatch,
  type AddStatus,
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

  it("a BACKWARD correction stamps nothing and dates nothing", () => {
    // "I only got through season 3" of a show marked watched. You got LESS far than the app thought;
    // there is nothing to date about that, and no viewing happened today.
    const p = positionPatch(sds(), 3, 24, "correction");
    expect(p.last_watched_at).toBeUndefined();
    expect(p.season_years).toBeUndefined();
  });

  it("a FORWARD correction dates the season it LANDS on — but never the ones it leaps over", () => {
    // The bug the owner saw: "Watched through S2" from the poster left the badge reading "Year",
    // while the add modal and "+1" both wrote the current year. Same act, three doors, two answers.
    //
    // The two halves are asserted together on purpose, because they pull in opposite directions:
    // landing is a claim about NOW (date it), leaping is a claim about SOME TIME (do not invent one).
    const from = sds({ watched: false, in_progress: true, current_season: 1, current_episode: 24 });
    const p = positionPatch(from, 3, 24, "correction");
    expect(p.season_years).toEqual({ "3": new Date().getFullYear() });
    // Still no viewing timestamp: catching the record up is not watching something today.
    expect(p.last_watched_at).toBeUndefined();
  });

  it("a forward correction onto a season still AIRING dates nothing — it isn't over", () => {
    // House of the Dragon S3: 3 of 8 episodes out. You cannot have finished what hasn't finished.
    const p = positionPatch(hotd({ current_season: 1, current_episode: 10 }), 3, 3, "correction");
    expect(p.season_years).toBeUndefined();
  });

  it("a hand-set year BEHIND your position survives a correction that passes it", () => {
    // staleStamp: what you claim now is protected. Season 1 was dated 2022 by hand; landing on
    // season 2 must not rewrite history to this year.
    const p = positionPatch(hotd({ current_season: 1, current_episode: 10 }), 2, 8, "correction");
    expect(p.season_years).toMatchObject({ "1": 2022 });
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

  it("reaching the frontier drops 'paused' — you're Caught up, not paused", () => {
    // Paused on House of the Dragon at S1; you come back and mark yourself through the last aired
    // episode. "Paused" means there is more you are not watching — and now there isn't.
    const p = positionPatch(hotd({ paused: true, in_progress: false, current_season: 1, current_episode: 5 }), 3, 3, "correction");
    expect(p.paused).toBe(false);
    expect(p.in_progress).toBe(true);
    expect(p.caught_up_at).toMatch(/^\d{4}-/);
  });

  it("but DROPPED survives being caught up — a decision not to continue, not a position", () => {
    // The House of the Dragon case the owner lived: watched all that aired, chose to stop.
    const p = positionPatch(hotd({ dropped: true, in_progress: false, current_season: 1, current_episode: 5 }), 3, 3, "correction");
    expect("paused" in p).toBe(false);
    expect(p.dropped).toBeUndefined();       // untouched → stays dropped
    expect(p.in_progress).toBeUndefined();   // not resumed
  });

  it("a paused show still SHORT of the frontier stays paused", () => {
    // S3 has aired; you jump forward only to the end of S2 — there is still more, so still paused.
    const p = positionPatch(hotd({ paused: true, in_progress: false, current_season: 1, current_episode: 5 }), 2, 8, "correction");
    expect("paused" in p).toBe(false);       // untouched
    expect(p.in_progress).toBeUndefined();
  });

  it("a BACKWARD correction never resumes a paused show", () => {
    const p = positionPatch(hotd({ paused: true, in_progress: false, current_season: 3, current_episode: 3 }), 2, 4, "correction");
    expect("paused" in p).toBe(false);       // fixing where you stopped, not coming back
  });

  it("dropped, then you finish a show that has ENDED → watched (completion outranks the stance)", () => {
    const p = positionPatch(sds({ watched: false, dropped: true, in_progress: false, current_season: 3, current_episode: 24 }), 4, 24, "correction");
    expect(p.watched).toBe(true);
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

// ── THE ADD PATH ──────────────────────────────────────────────────────────────────────────────
// The update path had one derivation and a zod barrier. The add path had neither — and that is
// where the limbo row came from. Every case below is a row the app could produce yesterday.

describe("addStatusPatch — a series takes its status from its POSITION, at every door", () => {
  const world = (facts: StatusFacts) => ({
    season_aired: facts.season_aired,
    season_episodes: facts.season_episodes,
    status: facts.status,
    caught_up_at: null,
  });

  const live = (p: AddStatus | null) =>
    (["watched", "in_progress", "want_to_watch", "paused", "dropped"] as const).filter((k) => p?.[k] === true);

  it("THE LIMBO ROW — a claim door with no claim is refused, not silently blanked", () => {
    // The bug, exactly: the "In Progress" door never collected a position, `claimedStatus` answered
    // null ("you claimed nothing"), every flag fell to false, and the row landed in no rail at all.
    for (const door of ["inProgress", "library", "recentlyWatched", "topTen"] as const) {
      expect(addStatusPatch(door, { position: null, facts: world(hotd()) }, "serie")).toBeNull();
    }
  });

  it("the In Progress door, given the position it should always have asked for, STARTS the show", () => {
    const p = addStatusPatch("inProgress", { position: { season: 2, episode: 4 }, facts: world(hotd()) }, "serie")!;
    expect(live(p)).toEqual(["in_progress"]);
    expect(p.current_season).toBe(2);
    expect(p.current_episode).toBe(4);
    expect(p.caught_up_at).toBeNull();      // behind the frontier — no lie in either direction
  });

  it("claiming the last AIRED episode of a running show is CAUGHT UP, never watched", () => {
    const p = addStatusPatch("library", { position: { season: 3, episode: 3 }, facts: world(hotd()) }, "serie")!;
    expect(live(p)).toEqual(["in_progress"]);
    expect(p.watched).toBe(false);
    expect(p.caught_up_at).toMatch(/^\d{4}-/);   // stood at the frontier → can light up as NEW later
  });

  it("claiming the end of a show that is OVER is watched — and takes the date you gave", () => {
    const p = addStatusPatch(
      "library",
      { position: { season: 4, episode: 24 }, facts: world(sds()), watchedAt: "2019-06-15T00:00:00.000Z" },
      "anime",
    )!;
    expect(live(p)).toEqual(["watched"]);
    expect(p.watched_at).toBe("2019-06-15T00:00:00.000Z");
  });

  it("RANKING IS NOT WATCHING — Top 10 on a running show you are partway through", () => {
    const p = addStatusPatch("topTen", { position: { season: 2, episode: 2 }, facts: world(hotd()) }, "serie")!;
    expect(live(p)).toEqual(["in_progress"]);
  });

  it("stopping partway is paused or dropped, as you said — never in_progress", () => {
    const paused = addStatusPatch("library", { position: { season: 2, episode: 2 }, stance: "paused", facts: world(hotd()) }, "serie")!;
    const dropped = addStatusPatch("library", { position: { season: 2, episode: 2 }, stance: "dropped", facts: world(hotd()) }, "serie")!;
    expect(live(paused)).toEqual(["paused"]);
    expect(live(dropped)).toEqual(["dropped"]);
  });

  it("Want to Watch claims nothing, so it needs nothing — and writes no position", () => {
    const p = addStatusPatch("wantToWatch", { position: null, facts: world(hotd()) }, "serie")!;
    expect(live(p)).toEqual(["want_to_watch"]);
    expect(p.current_episode).toBeNull();
  });

  it("a FILM still lets the door decide — it always could", () => {
    const facts = { season_aired: null, season_episodes: null, status: "released", caught_up_at: null };
    expect(live(addStatusPatch("library", { position: null, facts }, "film")!)).toEqual(["watched"]);
    expect(live(addStatusPatch("recentlyWatched", { position: null, facts }, "film")!)).toEqual(["watched"]);
    expect(live(addStatusPatch("topTen", { position: null, facts }, "film")!)).toEqual(["watched"]);
    expect(live(addStatusPatch("inProgress", { position: null, facts }, "film")!)).toEqual(["in_progress"]);
    expect(live(addStatusPatch("wantToWatch", { position: null, facts }, "film")!)).toEqual(["want_to_watch"]);
  });

  it("stamps a year only on seasons that are OVER — the add path had a fourth copy of that rule", () => {
    // It stamped against what had AIRED, so standing at HotD S3 E3 (3 of 8 out) dated a season
    // still coming out. `isSeasonDatable` — the rule "Set all year" and the season strip share —
    // needs it fully aired AND fully watched.
    const p = addStatusPatch(
      "library",
      { position: { season: 3, episode: 3 }, facts: world(hotd()), watchedAt: "2024-05-01T00:00:00.000Z" },
      "serie",
    )!;
    expect(p.season_years).toEqual({ "1": 2024, "2": 2024 });
  });

  it("no date asked → the CURRENT year, because that door is talking about now", () => {
    // Blue Lock added through "Start watching" at S2 E4: season 1 is plainly finished, and it
    // showed an empty "Year" placeholder because no door but `library` collects a date. Meanwhile
    // walking the same route with the "+1" stamps the current year. Same claim, two histories.
    const p = addStatusPatch("inProgress", { position: { season: 2, episode: 4 }, facts: world(hotd()) }, "serie")!;
    expect(p.season_years).toEqual({ "1": new Date().getFullYear() });
  });
});

describe("season years — a stamp you no longer claim is a leftover, not a memory", () => {
  const thisYear = new Date().getFullYear();

  it("FINISHING a season dates it — it used to date only the ones you LEFT", () => {
    // Watching the last episode of season 2 stamped nothing: the year appeared only once you
    // started season 3. A show you are caught up on never gets there at all.
    const p = positionPatch(sds({ watched: false, current_season: 2, current_episode: 23 }), 2, 24, "viewing");
    expect(p.season_years).toEqual({ "2": thisYear });
  });

  it("mid-season progress still stamps nothing — the season is not over", () => {
    const p = positionPatch(sds({ watched: false, current_season: 2, current_episode: 5 }), 2, 6, "viewing");
    expect(p.season_years).toBeUndefined();
  });

  it("THE CASE STUDY — un-claim a season, claim it again, and it re-dates", () => {
    // Blue Lock: finished, season 2 hand-set to 2025. Back to "through S1" → season 2 is not
    // watched any more and the app already stops READING its year. Mark it finished again and
    // 2025 came back: the poster remembering a viewing that had been retracted.
    const retracted = sds({
      watched: false, current_season: 1, current_episode: 24,
      season_years: { "1": 2024, "2": 2025 },
    });
    const p = markWatchedPatch(retracted);
    expect(p.season_years).toMatchObject({ "1": 2024, "2": thisYear });
  });

  it("…and a year you DO claim is still protected — the reason the rule exists", () => {
    // Same map, but you are standing at season 4: season 2 is behind you, so 2025 is a claim you
    // are actively making. Finishing the show must not rewrite it.
    const standing = sds({
      watched: false, current_season: 4, current_episode: 10,
      season_years: { "1": 2024, "2": 2025 },
    });
    const p = markWatchedPatch(standing);
    expect(p.season_years).toMatchObject({ "1": 2024, "2": 2025 });
  });

  it("a correction round trip LOSES NOTHING — the guarantee, asserted directly", () => {
    /**
     * Blue Lock: season 2 dated 2025 by hand. Step back to season 1, then forward again.
     *
     * This used to be asserted as "a correction never stamps anything", which was a stronger claim
     * than the guarantee needs — and it became false the day "Watched through S" started dating the
     * season it lands on (the owner's report: the poster left "Year" while the modal and "+1" both
     * wrote the year). What must hold is that nothing you SET is lost, and that still holds: only
     * the landed season is written, and a stamp you are not claiming is neither rewritten nor
     * deleted. Both halves are checked here so neither can be broken to satisfy the other.
     */
    const withYear = { watched: false, season_years: { "2": 2025 } } as const;

    // Backward — you got less far than the app thought. Nothing to date.
    const back = positionPatch(sds({ ...withYear, current_season: 3, current_episode: 24 }), 1, 24, "correction");
    expect(back.season_years).toBeUndefined();

    // Forward again — season 3 is where you now stand, so it takes today's year…
    const forward = positionPatch(sds({ ...withYear, current_season: 1, current_episode: 24 }), 3, 24, "correction");
    expect(forward.season_years?.["3"]).toBe(new Date().getFullYear());
    // …and the 2025 you typed is still there, untouched.
    expect(forward.season_years).toMatchObject({ "2": 2025 });
  });
});

describe("insertMediaSchema — the barrier the add door never had", () => {
  const row = (over: Record<string, unknown> = {}) => ({
    user_id: "u1", type: "serie", tmdb_id: 94997,
    watched: false, in_progress: false, want_to_watch: false,
    ...over,
  });
  const fails = (over: Record<string, unknown>, path: string) => {
    const r = insertMediaSchema.safeParse(row(over));
    expect(r.success).toBe(false);
    expect(r.error?.issues.some((i) => i.path[0] === path)).toBe(true);
  };

  it("refuses the LIMBO row — no status at all", () => {
    fails({}, "watched");
  });

  it("refuses two statuses at once — the drift deriveWatchStatus exists to arbitrate", () => {
    fails({ watched: true, current_season: 4, current_episode: 24, caught_up_at: null, dropped: true }, "watched");
  });

  it("refuses a series you claim to be watching with no position", () => {
    fails({ in_progress: true }, "current_episode");
    fails({ watched: true }, "current_episode");
  });

  it("refuses a position that does not state caught_up_at", () => {
    const r = insertMediaSchema.safeParse({ ...row({ in_progress: true }), current_season: 2, current_episode: 4 });
    expect(r.success).toBe(false);
    expect(r.error?.issues.some((i) => i.path[0] === "caught_up_at")).toBe(true);
  });

  it("accepts the bare list stub — `is_reference` is a status, and a deliberate one", () => {
    expect(insertMediaSchema.safeParse(row({ is_reference: true })).success).toBe(true);
  });

  it("accepts what claims no viewing: want_to_watch, and a watched FILM", () => {
    expect(insertMediaSchema.safeParse(row({ want_to_watch: true })).success).toBe(true);
    expect(insertMediaSchema.safeParse(row({ type: "film", watched: true, watched_at: "2024-01-01T00:00:00.000Z" })).success).toBe(true);
  });
});

describe("updateMediaSchema — the barrier is now in the pipe (updateMediaItem parses this)", () => {
  // Fable's find: the invariant "a position write recomputes caught_up_at" lived only in
  // useUpdateMedia's memory, and addTmdbItemToList walked around it. It now runs inside
  // updateMediaItem, so every update path is gated — including doors not written yet.
  it("refuses a position write that forgets caught_up_at", () => {
    const r = updateMediaSchema.safeParse({ id: "x", current_season: 2, current_episode: 4 });
    expect(r.success).toBe(false);
    expect(r.error?.issues.some((i) => i.path[0] === "caught_up_at")).toBe(true);
  });

  it("accepts a position write that carries caught_up_at (null is a valid answer)", () => {
    expect(updateMediaSchema.safeParse({ id: "x", current_season: 2, current_episode: 4, caught_up_at: null }).success).toBe(true);
  });

  it("accepts a non-position update — a heal writing only world facts", () => {
    // addTmdbItemToList's `meta`: runtime/status/season arrays, no position. The gate must pass it.
    expect(updateMediaSchema.safeParse({ id: "x", season_episodes: [10, 8], season_air_dates: ["2022-08-21", null] }).success).toBe(true);
  });

  it("does not THROW on undeclared world-fact columns — updateMediaItem writes `data`, not this output", () => {
    // `runtime`/`status`/`studio` are not declared here; a stripping parse drops them from its
    // RETURN, which updateMediaItem ignores. What matters: it must not reject the write.
    const r = updateMediaSchema.safeParse({ id: "x", runtime: 66, status: "ended", studio: "HBO" });
    expect(r.success).toBe(true);
  });
});

describe("insertMediaSchema — the two locks agree (continued)", () => {
  it("every door x type that addStatusPatch answers passes the barrier", () => {
    const worlds = {
      film:  { season_aired: null, season_episodes: null, status: "released", caught_up_at: null },
      serie: { season_aired: [10, 8, 3], season_episodes: [10, 8, 8], status: "ongoing", caught_up_at: null },
      anime: { season_aired: [24, 24, 24, 24], season_episodes: [24, 24, 24, 24], status: "ended", caught_up_at: null },
    };
    const doors = ["topTen", "inProgress", "recentlyWatched", "wantToWatch", "library"] as const;
    const positions = { film: null, serie: { season: 2, episode: 4 }, anime: { season: 4, episode: 24 } } as const;

    for (const type of ["film", "serie", "anime"] as const) {
      for (const door of doors) {
        const patch = addStatusPatch(
          door,
          { position: positions[type], facts: worlds[type], watchedAt: "2024-05-01T00:00:00.000Z" },
          type,
        );
        expect(patch, `${type} / ${door}`).not.toBeNull();
        const parsed = insertMediaSchema.safeParse({ user_id: "u1", type, tmdb_id: 1, ...patch! });
        expect(parsed.success, `${type} / ${door}: ${JSON.stringify(parsed.error?.issues)}`).toBe(true);
      }
    }
  });
});
