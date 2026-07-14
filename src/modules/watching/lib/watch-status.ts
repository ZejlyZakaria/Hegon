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
import {
  caughtUpAt,
  isFinished,
  isSeasonComplete,
  lastAiredPosition,
  seriesState,
  type SeriesFacts,
} from "./series-state";
import type { UpdateMediaInput } from "../schemas/media.schema";
import type { WatchingMedia, WatchStatus } from "../types";

/** Everything a transition needs to know about the row. A subset, so cards can call these too. */
export type StatusFacts = Pick<
  WatchingMedia,
  | "type" | "status" | "watched" | "in_progress" | "paused" | "dropped" | "favorite"
  | "current_season" | "current_episode"
  | "season_episodes" | "season_aired" | "season_years" | "caught_up_at"
>;

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
 * A film: always — you either saw it or you didn't. A series: only once it is over. You cannot
 * finish a story that is still being told, and no button in this app may pretend otherwise.
 */
export function canComplete(m: Pick<StatusFacts, "type" | "status">): boolean {
  return m.type === "film" || isFinished(m.status);
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
export function markWatchedPatch(m: StatusFacts): StatusPatch {
  const isSeries = m.type !== "film";
  const last = isSeries ? lastAiredPosition(m) : null;

  // With no airing data (a row the sync has never reached) we keep the old behaviour rather than
  // silently stamping nothing — a loose stamp beats an empty history.
  const hasAiring = (m.season_aired?.length ?? 0) > 0;
  const stampable = (m.season_episodes ?? [])
    .map((_, idx) => idx + 1)
    .filter((s) => !hasAiring || isSeasonComplete(m, s));

  // ⚠️ `stampSeasons` MERGES. Merging into `undefined` and writing the result would REPLACE the
  // jsonb column with a single entry and wipe every year you had set by hand. If the column was
  // not loaded, we do not touch it. (This is why SECTION_COLUMNS carries `season_years`.)
  const seasonYears =
    stampable.length > 0 && m.season_years !== undefined
      ? stampSeasons(m.season_years, stampable, new Date().getFullYear())
      : undefined;

  const at = new Date().toISOString();
  return {
    watched: true,
    recently_watched: true,
    in_progress: false,
    want_to_watch: false,
    is_reference: false,
    ...RESET_STATUS,
    watched_at: at,
    ...(last
      ? { current_season: last.season, current_episode: last.episode, caught_up_at: caughtUpAt({ ...m, current_season: last.season, current_episode: last.episode }, m.caught_up_at) }
      : {}),
    ...(seasonYears ? { season_years: seasonYears } : {}),
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
export function markCaughtUpPatch(m: StatusFacts): StatusPatch | null {
  const last = lastAiredPosition(m);
  if (!last) return null;

  const facts = { ...m, current_season: last.season, current_episode: last.episode };
  const stampable = (m.season_episodes ?? [])
    .map((_, idx) => idx + 1)
    .filter((s) => isSeasonComplete(m, s));
  const seasonYears =
    stampable.length > 0 && m.season_years !== undefined
      ? stampSeasons(m.season_years, stampable, new Date().getFullYear())
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
    ...(seasonYears ? { season_years: seasonYears } : {}),
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
): StatusPatch {
  const from = { season: m.current_season ?? 1, episode: m.current_episode ?? 0 };
  const forward = season > from.season || (season === from.season && episode > from.episode);
  const facts = { ...m, current_season: season, current_episode: episode };
  const completed = m.type === "film" || seriesState(facts) === "completed";

  // Law 2. A correction is you stating the record, so it may complete. A viewing may not: "+1"
  // hands you off to a deliberate "Finish" instead. Revocation applies to both.
  const completes = kind === "correction" && completed && !m.watched;
  const revokes = !!m.watched && !completed;

  // Seasons you have just travelled PAST, and only those that have fully aired. A correction
  // stamps nothing: you are claiming to have watched them, not to have watched them TODAY.
  const crossed = kind === "viewing" && forward && season > from.season
    ? seasonRange(from.season, season - 1).filter((s) => isSeasonComplete(m, s))
    : [];
  const seasonYears =
    crossed.length > 0 && m.season_years !== undefined
      ? stampSeasons(m.season_years, crossed, new Date().getFullYear())
      : undefined;

  return {
    current_season: season,
    current_episode: episode,
    caught_up_at: caughtUpAt(facts, m.caught_up_at),
    ...(kind === "viewing" && forward ? { last_watched_at: new Date().toISOString() } : {}),
    ...(seasonYears ? { season_years: seasonYears } : {}),
    ...(completes
      ? { watched: true, in_progress: false, want_to_watch: false, is_reference: false, ...RESET_STATUS, watched_at: new Date().toISOString() }
      : {}),
    ...(revokes
      // It was "finished". It isn't any more — and it must leave the finished rails too, or it
      // keeps surfacing in Recently Watched as a show you completed.
      ? { watched: false, recently_watched: false, in_progress: !m.paused && !m.dropped }
      : {}),
  };
}
