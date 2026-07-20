/**
 * THE ONLY PLACE A STATUS IS WRITTEN.
 *
 * Every status change in this module used to be hand-assembled at the call site — an object
 * literal of five booleans, written out again in the detail page, in the "…" menu of every poster
 * card, and inside list rows. Three copies, three rules, and they drifted exactly as three copies
 * always do: the detail page learned that an ongoing show cannot be "watched", and the cards went
 * on offering "Mark as finished" on House of the Dragon, writing `watched: true` over a blank
 * position — manufacturing, one tap at a time, the very rows a migration had just repaired.
 *
 * So the object literals are gone. Every transition is a PURE FUNCTION of the row, returning the
 * patch to write. New surfaces get the rules for free instead of re-deriving them, and a rule that
 * changes changes once.
 *
 * ── THE TWO LAWS ─────────────────────────────────────────────────────────────────────────────
 *
 * 1. A VIEWING IS NOT A CORRECTION. Same column, same movement, opposite meaning.
 *    Tapping "+1" means you watched an episode, today: it dates the viewing and stamps the year of
 *    any season you just finished. Saying "I watched through season 3" of a show you left in 2018
 *    means no such thing — stamping today's year there would replace one false claim with another.
 *    Only the caller knows which it is, so only the caller can say.
 *
 * 2. A VIEWING NEVER CLAIMS COMPLETION. A CORRECTION MAY — AND EITHER MAY REVOKE ONE.
 *    A stepper must not finish a show by stealth: completion ripples into Goals and Habits, and it
 *    deserves the rating you are about to have an opinion about. But a CORRECTION is you making a
 *    statement about the record — "I watched through season 4" of a four-season, finished show IS
 *    "I watched it", and making you click a second button would be friction without truth.
 *    Revocation, by contrast, is never optional: if the row says "watched" and you have just said
 *    you stopped at season 3 of four, the claim is dead on arrival, whoever moved the marker.
 */

import { stampSeasons, seasonRange } from "./season-years";
import { RESET_STATUS } from "./status-flags";
import { buildWatchedAt } from "./watched-date";
import {
  caughtUpAt,
  hasReachedSeason,
  isFinished,
  isSeasonComplete,
  isSeasonDatable,
  lastAiredPosition,
  seriesState,
  type SeriesFacts,
} from "./series-state";
import type { MediaView } from "./media-view";
import { isAwaitingRelease } from "../utils";
import type { UpdateMediaInput } from "../schemas/media.schema";
import type { ListType, MediaType, WatchingMedia, WatchStatus } from "../types";

/** Everything a transition needs to know about the row. A subset, so cards can call these too. */
export type StatusFacts = Pick<
  WatchingMedia,
  | "type" | "status" | "watched" | "in_progress" | "paused" | "dropped" | "favorite"
  | "current_season" | "current_episode"
  | "season_episodes" | "season_aired" | "season_years" | "caught_up_at"
> & {
  /** Release year — optional so card-level callers and tests need not always supply it. */
  year?: number | null;
};

/** The patch to hand to `useUpdateMedia` — everything but the id. */
export type StatusPatch = Omit<UpdateMediaInput, "id">;

// ── Reading the status ────────────────────────────────────────────────────────────────────────

/**
 * ONE answer to "what is this row's status".
 *
 * There were two. The service read `dropped > paused > watched`; the StatusCard read
 * `watched > dropped > paused` — under a comment claiming it mirrored the service. So a row
 * carrying both flags (a partial write is all it takes) said "Watched" on the detail page and
 * "Dropped" in a list. Two rules, two truths, one screen: the module's signature bug, sitting on
 * its most central word.
 *
 * The stances win, and that is the deliberate choice RESET_STATUS was built around: dropping a
 * show is something you DID, and it must not be silently outranked by a stale flag.
 */
export function deriveWatchStatus(item: {
  is_reference?: boolean; dropped?: boolean; paused?: boolean;
  watched?: boolean; in_progress?: boolean; want_to_watch?: boolean;
}): WatchStatus {
  if (item.is_reference) return "reference";
  if (item.dropped) return "dropped";
  if (item.paused) return "paused";
  if (item.watched) return "completed";
  if (item.in_progress) return "watching";
  return "plan_to_watch";
}

/**
 * May this title honestly be called WATCHED?
 *
 *   · A SERIES — only once it is over. You cannot finish a story still being told.
 *   · A FILM   — only once it has been RELEASED. "Released" is the exact inverse of the Waiting for
 *     rail's `isAwaitingRelease`, and it reads the SAME predicate on purpose: the Mark-as-watched
 *     button and the rail derive from one source (`release_date`), so they can never contradict each
 *     other. TMDB's `status` is NOT trusted as the primary signal — it flips to "Released" before a
 *     film is actually out (The Odyssey read "Released" the day before opening). release_date is the
 *     truth; status/year are fallbacks only for legacy rows that predate the column.
 */
export function canComplete(m: {
  type?: string | null;
  status?: string | null;
  year?: number | null;
  release_date?: string | null;
}): boolean {
  if (m.type == null) return true;                       // unknown type → don't block on ignorance
  if (m.type !== "film") return isFinished(m.status);
  return !isAwaitingRelease({ type: "film", release_date: m.release_date, status: m.status, year: m.year });
}

/** The latest year stamped across a season-years map — the year you finished the show. */
export function maxYear(map: Record<string, number> | null | undefined): number | null {
  const years = Object.values(map ?? {}).filter((y): y is number => typeof y === "number");
  return years.length ? Math.max(...years) : null;
}

/** `watched_at` for a series, from its finish year — or `now` when we have no year (finishing live). */
function dateFromFinishYear(year: number | null): string {
  return year ? buildWatchedAt({ year, month: null, day: null }) : new Date().toISOString();
}

/**
 * Which of a row's season stamps are LEFTOVERS — years for seasons the row does not currently
 * claim to have watched. Passed to `stampSeasons` so a fresh claim re-dates them instead of
 * inheriting a viewing you had retracted. Read against the position BEFORE the write.
 */
const staleStamp = (m: SeriesFacts & { watched?: boolean }) => (season: number) =>
  !hasReachedSeason(m, season);

/**
 * WHERE THE SEASON MATH HAPPENS — the one thing that differs between the two coordinate spaces.
 *
 * A lumped anime has ONE flat TMDB season but two real cours. "Which season did I just finish?"
 * therefore has two different answers, and the year belongs in a different COLUMN depending on which
 * one you mean (`season_years` keyed by TMDB season vs `cour_years` keyed by cour). Every automatic
 * stamp used to answer in storage space and write `season_years` — a map the strip never reads for
 * an overlaid title. That is the whole bug, and this is the seam that closes it.
 *
 * Status is NOT routed here on purpose: episodes-seen and episodes-aired sum to the same totals in
 * either space, so `seriesState`/`caughtUpAt` are space-invariant and go on reading the raw row.
 *
 * No lens supplied → identical behaviour to before, byte for byte. That is what keeps every
 * non-overlaid title (and every existing test) untouched.
 */
function stampSpace(m: StatusFacts, view?: MediaView | null) {
  if (!view) {
    return {
      facts: m as SeriesFacts & { watched?: boolean },
      count: (m.season_episodes ?? []).length,
      position: { season: m.current_season ?? 1, episode: m.current_episode ?? 0 },
      map: m.season_years,
      toView: (season: number, episode: number) => ({ season, episode }),
      write: (next: Record<string, number>) => ({ season_years: next }) as StatusPatch,
    };
  }
  return {
    facts: { ...view.seriesFacts, watched: m.watched },
    count: view.seasons.length,
    position: view.position,
    map: view.yearMap,
    toView: (season: number, episode: number) => view.fromStorage(season, episode),
    write: (next: Record<string, number>) => view.writeYears(next) as StatusPatch,
  };
}

// ── The transitions ───────────────────────────────────────────────────────────────────────────

/**
 * "I have watched this."
 *
 * For a series it also MOVES YOU to the last aired episode. A `watched` row with no position is
 * the exact row this whole model exists to prevent: `watchedCount()` reads a null position as
 * zero episodes seen, so the title claims to be finished while every derived rule believes you
 * have watched nothing of it — and Quick Stats prints "0 / 62 episodes" under the word "Watched".
 * The claim and its evidence travel together, or not at all.
 *
 * And it stamps only the seasons that have FULLY AIRED. Stamping every ANNOUNCED season put
 * "2026" on a season with four of its eight episodes out.
 */
export function markWatchedPatch(m: StatusFacts, view?: MediaView | null): StatusPatch {
  const isSeries = m.type !== "film";
  const last = isSeries ? lastAiredPosition(m) : null;
  const sp = stampSpace(m, view);

  // With no airing data (a row the sync has never reached) we keep the old behaviour rather than
  // silently stamping nothing — a loose stamp beats an empty history.
  const hasAiring = (m.season_aired?.length ?? 0) > 0;
  const stampable = Array.from({ length: sp.count }, (_, idx) => idx + 1)
    .filter((s) => !hasAiring || isSeasonComplete(sp.facts, s));

  // ⚠️ `stampSeasons` MERGES. Merging into `undefined` and writing the result would REPLACE the
  // jsonb column with a single entry and wipe every year you had set by hand. If the column was
  // not loaded, we do not touch it. (This is why SECTION_COLUMNS carries `season_years`.)
  const seasonYears =
    stampable.length > 0 && sp.map !== undefined
      ? stampSeasons(sp.map, stampable, new Date().getFullYear(), staleStamp(sp.facts))
      : undefined;

  // WHEN did you watch it — and for a series that is NOT the moment you clicked. The truth is the
  // year you finished the last season (`season_years`), so `watched_at` follows it: a show you
  // finished in 2014 gets a 2014 timestamp, not "now", and it no longer sits atop Recently Watched
  // with a "2 weeks ago" badge. `buildWatchedAt` maps the current year back to `now`, so finishing
  // something today still stamps today. A film keeps `now` (the date picker refines it).
  const watchedAt = isSeries ? dateFromFinishYear(maxYear(seasonYears ?? sp.map)) : new Date().toISOString();

  return {
    watched: true,
    in_progress: false,
    want_to_watch: false,
    is_reference: false,
    ...RESET_STATUS,
    watched_at: watchedAt,
    ...(last
      ? { current_season: last.season, current_episode: last.episode, caught_up_at: caughtUpAt({ ...m, current_season: last.season, current_episode: last.episode }, m.caught_up_at) }
      : {}),
    ...(seasonYears ? sp.write(seasonYears) : {}),
  };
}

/**
 * "I have seen everything that's out." The truthful action for a show that isn't over, and the one
 * the app never had — which is why people reached for "watched" and lied.
 *
 * It lands you at the last AIRED episode and stamps `caught_up_at`. Then the day season 4 drops,
 * the sync raises what has aired, you are mechanically behind again, and the card lights up as
 * NEW. No boolean anyone has to remember to flip back.
 *
 * Returns null when we don't know what has aired — we do not guess, and the caller must say so.
 */
export function markCaughtUpPatch(m: StatusFacts, view?: MediaView | null): StatusPatch | null {
  const last = lastAiredPosition(m);
  if (!last) return null;

  const facts = { ...m, current_season: last.season, current_episode: last.episode };
  const sp = stampSpace(m, view);
  const stampable = Array.from({ length: sp.count }, (_, idx) => idx + 1)
    .filter((s) => isSeasonComplete(sp.facts, s));
  const seasonYears =
    stampable.length > 0 && sp.map !== undefined
      ? stampSeasons(sp.map, stampable, new Date().getFullYear(), staleStamp(sp.facts))
      : undefined;

  return {
    in_progress: true,
    watched: false,
    want_to_watch: false,
    is_reference: false,
    ...RESET_STATUS,
    current_season: last.season,
    current_episode: last.episode,
    caught_up_at: caughtUpAt(facts, m.caught_up_at),
    last_watched_at: new Date().toISOString(),
    ...(seasonYears ? sp.write(seasonYears) : {}),
  };
}

/**
 * THE STATUS OF A CLAIM — "here is how far I got", from any door.
 *
 * This is what the add modal is really collecting, and what "rank it in my Top 10" was quietly
 * asserting on your behalf. Ranking a show is not watching it: `update:topTen` wrote `watched: true`
 * unconditionally, so putting House of the Dragon in your Top 10 declared a running show finished —
 * the fourth door, still open, under a comment claiming the doors were shut.
 *
 * One derivation, therefore, for every door: the status falls out of the POSITION you claim and the
 * stance you take, and nothing else. `null` position means you are claiming nothing, and a claim of
 * nothing must change nothing.
 */
export function claimedStatus(
  // Deliberately NARROWER than StatusFacts: a claim is answered by the world (what aired, is it
  // over) and by your position. The row's current flags have no say — that is the whole point.
  m: SeriesFacts & { type?: string },
  position: { season: number; episode: number } | null,
  stance: "watching" | "paused" | "dropped" = "watching",
): StatusPatch | null {
  if (!position) return null;

  const facts = { ...m, current_season: position.season, current_episode: position.episode };
  const state = seriesState(facts);
  const watched = state === "completed";

  // You stopped PARTWAY. "In Progress" means you are watching it NOW — a show you left three
  // seasons in, five years ago, is paused or dropped, and the app owned those words all along. It
  // simply never asked. Being CAUGHT UP is not stopping partway: there is nothing left to watch.
  const partway = !watched && state !== "caught-up";

  return {
    watched,
    dropped: partway && stance === "dropped",
    paused: partway && stance === "paused",
    in_progress: !watched && !(partway && stance !== "watching"),
    current_season: position.season,
    current_episode: position.episode,
    caught_up_at: caughtUpAt(facts, m.caught_up_at),
    ...(watched ? { watched_at: new Date().toISOString() } : {}),
  };
}

// ── The ADD path ──────────────────────────────────────────────────────────────────────────────

/** The status columns of a BRAND-NEW row — every one of them, stated. */
export interface AddStatus {
  watched: boolean;
  in_progress: boolean;
  want_to_watch: boolean;
  /**
   * Always FALSE here, and stated rather than omitted. Adding a title that already exists as a bare
   * list stub MERGES onto that row — and an omitted flag is not a cleared one, so the stub stayed
   * `is_reference: true`, which `deriveWatchStatus` reads FIRST: the title you had just added went
   * on reading "Unwatched", in no rail, whatever you had claimed.
   */
  is_reference: boolean;
  paused: boolean;
  dropped: boolean;
  drop_reason: string | null;
  watched_at: string | null;
  caught_up_at: string | null;
  current_season: number | null;
  current_episode: number | null;
  /** Only when the claim dates seasons — a fresh row has no map to merge into. */
  season_years?: Record<string, number> | null;
}

/** What a door collected. `position: null` means "I am claiming nothing". */
export interface AddClaim {
  position: { season: number; episode: number } | null;
  stance?: "watching" | "paused" | "dropped";
  /** The world's facts for the title being added — what aired, and whether it is over. */
  facts: SeriesFacts;
  /** The date the door asked for, if it asked. */
  watchedAt?: string | null;
}

/** Nothing true. Every add starts here, so no column is left to a default. */
const NO_STATUS: AddStatus = {
  watched: false, in_progress: false, want_to_watch: false, is_reference: false,
  paused: false, dropped: false, drop_reason: null,
  watched_at: null, caught_up_at: null,
  current_season: null, current_episode: null,
};

/**
 * THE STATUS OF A NEW ROW — the add path's `claimedStatus`, and the end of assembling flags by hand.
 *
 * `useAddMedia` used to build its status one boolean at a time, from the DOOR you came through. For
 * a film that is honest: "seen it / haven't" is binary and the door knows. For a SERIES it is the
 * lie this whole model exists to kill — and the add path was still telling it, in a way no test
 * could see: the "In Progress" door never collected a position, so `claimedStatus` returned `null`
 * (its answer to "you claimed nothing"), every flag fell to `false`, and the row landed in LIMBO —
 * no status at all. Invisible in every rail, "Want to Watch" on its own detail page. The three
 * buttons on the discover card did not cause that; they walked into it.
 *
 * So the add path derives, exactly like every other path:
 *   · FILM   — the door decides. It always could.
 *   · SERIES — the POSITION decides, via `claimedStatus`. The door only says whether a claim is
 *     being made at all (`wantToWatch` makes none, by definition).
 *
 * Returns `null` when a door that NEEDS a claim was given none. That is not a status to write, it
 * is a question that was never asked — and a caller that ignores the null gets refused again by
 * `insertMediaSchema`. Two barriers, because this row must never exist.
 */
export function addStatusPatch(
  door: ListType,
  claim: AddClaim,
  type: MediaType,
): AddStatus | null {
  const now = () => new Date().toISOString();

  if (door === "wantToWatch") return { ...NO_STATUS, want_to_watch: true };

  if (type === "film") {
    // A film cannot be half-watched, so "In Progress" is the only door that isn't a completion.
    if (door === "inProgress") return { ...NO_STATUS, in_progress: true };
    return { ...NO_STATUS, watched: true, watched_at: claim.watchedAt ?? now() };
  }

  const claimed = claimedStatus({ ...claim.facts, type }, claim.position ?? null, claim.stance);
  if (!claimed || !claim.position) return null;

  // THE YEAR YOU GIVE BELONGS TO THE SEASONS YOU CLAIM — and only to the ones that are over, in
  // both senses: fully aired, and fully watched. That is `isSeasonDatable`, the rule "Set all year"
  // and the season strip already share. The add path had invented a FOURTH version of it, stamping
  // against what had aired instead of what was announced — so a season 4 episodes into its 8 got a
  // year the moment you claimed to stand at its end.
  //
  // A DOOR THAT DOES NOT ASK ABOUT THE PAST IS TALKING ABOUT NOW. Only the library door collects a
  // date; the others ("Start watching", "Last Watched", "Top 10") mean "this is where I am today".
  // Requiring a date before stamping anything left those doors writing NOTHING, so adding Blue Lock
  // at season 2 episode 4 — season 1 finished, plainly — showed an empty "Year" placeholder on it.
  // And it disagreed with the "+1": walking that same route with the stepper stamps the current
  // year on every season you complete. Same claim, same position, two different histories.
  // The year is a default, not a verdict: the season is datable, so one click corrects it.
  const claimedYear = new Date(claim.watchedAt ?? Date.now()).getFullYear();
  const stamped = { ...claim.facts, current_season: claim.position.season, current_episode: claim.position.episode };
  const seasonYears = Object.fromEntries(
    (claim.facts.season_episodes ?? [])
      .map((_, idx) => idx + 1)
      .filter((season) => isSeasonDatable(stamped, season))
      .map((season) => [String(season), claimedYear]),
  );

  return {
    ...NO_STATUS,
    ...claimed,
    // `claimedStatus` dates a completion "now"; a door that asked WHEN overrules it.
    watched_at: claimed.watched ? (claim.watchedAt ?? claimed.watched_at ?? now()) : null,
    ...(Object.keys(seasonYears).length ? { season_years: seasonYears } : {}),
  };
}

export function startWatchingPatch(): StatusPatch {
  return { in_progress: true, watched: false, want_to_watch: false, is_reference: false, ...RESET_STATUS };
}

export function wantToWatchPatch(): StatusPatch {
  return { want_to_watch: true, watched: false, in_progress: false, is_reference: false, ...RESET_STATUS };
}

export function pausePatch(): StatusPatch {
  return { paused: true, dropped: false, drop_reason: null, in_progress: false };
}

export function dropPatch(reason: string | null): StatusPatch {
  return { dropped: true, drop_reason: reason, paused: false, in_progress: false };
}

export function resumePatch(): StatusPatch {
  return { dropped: false, drop_reason: null, paused: false, in_progress: true };
}

/**
 * WHERE YOU STAND. The one write that touches a position — the "+1", the steppers, the Undo, and
 * "I watched through season 3".
 *
 * `kind` is not a convenience flag, it is the fact the caller alone knows:
 *   · "viewing"    — you are watching it, now. It dates the viewing and stamps the year of any
 *                    season you have just finished.
 *   · "correction" — you are fixing the record. Seven Deadly Sins was years ago; dating it today
 *                    would replace one false claim with another. Nothing is stamped.
 *
 * `caught_up_at` is recomputed here, unconditionally, because it is a FUNCTION of where you stand.
 * That is the invariant the Undo of "+1" quietly broke: it put the position back and left the
 * stamp behind, so a show you had never caught up to would light up as "New episodes" the next
 * time an episode aired. An invariant that depends on remembering is not an invariant — so it
 * lives here, at the only place a position is written.
 */
export function positionPatch(
  m: StatusFacts,
  season: number,
  episode: number,
  kind: "viewing" | "correction",
  /**
   * The lens, when the title has one. `season`/`episode` stay in STORAGE coordinates — every caller
   * already speaks them — and we translate INTERNALLY to decide which season you just finished.
   * That is the inversion the fix needs: converting cour→flat before this function ran is precisely
   * what made a cour boundary look like "same season, one episode further", so nothing was stamped.
   */
  view?: MediaView | null,
): StatusPatch {
  const from = { season: m.current_season ?? 1, episode: m.current_episode ?? 0 };
  const forward = season > from.season || (season === from.season && episode > from.episode);
  const facts = { ...m, current_season: season, current_episode: episode };
  const completed = m.type === "film" || seriesState(facts) === "completed";

  // Law 2. A correction is you stating the record, so it may complete. A viewing may not: "+1"
  // hands you off to a deliberate "Finish" instead. Revocation applies to both.
  const completes = kind === "correction" && completed && !m.watched;
  const revokes = !!m.watched && !completed;

  // Reaching the last AIRED episode makes "paused" a lie: paused means there is more you are not
  // watching, and now there isn't — you are Caught up. DROPPED survives this (it is a decision not
  // to continue, still true when you have seen everything out — you watched all of House of the
  // Dragon that aired and chose to stop); PAUSED does not, because it says nothing "caught up"
  // doesn't already say. Forward only: a backward correction is fixing where you stopped, not
  // resuming.
  const resumesFromPause =
    !!m.paused && forward && !completed && seriesState(facts) === "caught-up";

  // ── THE YEAR, DECIDED IN DISPLAY SPACE ───────────────────────────────────────────────────────
  // Season boundaries are the only thing the two coordinate spaces disagree about, so the stamp —
  // and the column it lands in — is computed through the lens. Without one this is the identity and
  // the behaviour is unchanged.
  const sp = stampSpace(m, view);
  const fromV = sp.toView(from.season, from.episode);
  const toV = sp.toView(season, episode);
  const factsV = { ...sp.facts, current_season: toV.season, current_episode: toV.episode };

  // Seasons you have just travelled PAST, and only those that have fully aired. A correction
  // stamps nothing: you are claiming to have watched them, not to have watched them TODAY.
  const crossed = kind === "viewing" && forward && toV.season > fromV.season
    ? seasonRange(fromV.season, toV.season - 1).filter((s) => isSeasonComplete(sp.facts, s))
    : [];

  // AND THE SEASON YOU JUST FINISHED. It stamped what you LEAVE, not what you COMPLETE — so
  // watching the last episode of season 2 dated nothing, and the year only appeared once you
  // started season 3. A show you are caught up on never reached that point at all: its final
  // season stayed blank for as long as you kept up with it. Finishing a season is the very
  // moment it becomes datable, so that is when it gets its year.
  const landed = kind === "viewing" && forward && isSeasonDatable(factsV, toV.season) ? [toV.season] : [];

  const toStamp = [...crossed, ...landed];
  const seasonYears =
    toStamp.length > 0 && sp.map !== undefined
      ? stampSeasons(sp.map, toStamp, new Date().getFullYear(), staleStamp(sp.facts))
      : undefined;

  return {
    current_season: season,
    current_episode: episode,
    caught_up_at: caughtUpAt(facts, m.caught_up_at),
    ...(kind === "viewing" && forward ? { last_watched_at: new Date().toISOString() } : {}),
    ...(seasonYears ? sp.write(seasonYears) : {}),
    ...(completes
      ? {
          watched: true, in_progress: false, want_to_watch: false, is_reference: false, ...RESET_STATUS,
          // Same as markWatchedPatch: a series is finished WHEN its last season aired, not when you
          // corrected the record. The finish year (from season_years) dates it; buildWatchedAt maps
          // the current year back to now.
          watched_at: dateFromFinishYear(maxYear(seasonYears ?? sp.map)),
        }
      : {}),
    ...(revokes
      // It was "finished". It isn't any more — and it must leave the finished rails too (its
      // watched_at stops mattering because `watched` is false), or it keeps surfacing as completed.
      ? { watched: false, in_progress: !m.paused && !m.dropped }
      : {}),
    ...(resumesFromPause ? { paused: false, in_progress: true } : {}),
  };
}
