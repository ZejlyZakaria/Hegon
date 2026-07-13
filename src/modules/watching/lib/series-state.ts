/**
 * THE STATE OF A SERIES — derived, never stored.
 *
 * The bug this replaces: `watched` conflated two different facts.
 *   · "I've seen everything that exists"  → you are CAUGHT UP
 *   · "This story is over for me"         → you have FINISHED
 * For a film they're the same. For an ongoing series they are not — and the app only owned the
 * second word, so it forced you to lie. 25 rows in the library say `watched` on a show TMDB
 * still calls `ongoing` (The Boys, The Last of Us, Silo, FROM…). Those aren't user mistakes.
 * They're the only word the app ever offered.
 *
 * ── AIRED ≠ ANNOUNCED ────────────────────────────────────────────────────────────────────
 * The concept the model was missing. TMDB lists ANNOUNCED seasons: House of the Dragon carries
 * `season_episodes = [10, 8, 8]` while only THREE episodes of season 3 have actually aired.
 *
 *   season_episodes → what exists on paper
 *   season_aired    → what you could actually have watched   ([10, 8, 3])
 *
 * Every rule below reads `season_aired`. Nothing decides anything from `season_episodes`.
 *
 * ── AND THE TRUTH MOVES ON ITS OWN ───────────────────────────────────────────────────────
 * State is a function of TWO numbers: what you've seen, and what has aired. Season 4 drops →
 * the sync job raises `aired` → you are mechanically no longer caught up. No boolean to flip,
 * therefore no boolean to forget. Forgetting is exactly how those 25 rows got there.
 */

export type SeriesState =
  | "watching"     // behind what has aired
  | "new"          // you WERE caught up, and new episodes have since aired
  | "caught-up"    // seen everything aired, but the show isn't over
  | "completed";   // seen everything, and the show is over

export interface SeriesFacts {
  /** Per season, how many episodes have ACTUALLY AIRED. The only source of truth for progress. */
  season_aired?: number[] | null;
  /** Per season, how many episodes are ANNOUNCED. Display only — never a decision. */
  season_episodes?: number[] | null;
  /** TMDB status, normalised. "canceled" is FINISHED: no episode is ever coming. */
  status?: string | null;
  current_season?: number | null;
  current_episode?: number | null;
  /** When you last reached the end of what had aired. Non-null = you were caught up once. */
  caught_up_at?: string | null;
}

/**
 * `season_aired` straight from a TMDB show payload — for FREE.
 *
 * The add modal already fetches `tv/{id}`, and that response carries `last_episode_to_air`:
 * TMDB's own answer to "what is the newest episode that exists". House of the Dragon returns
 * S3 E4 — precisely the frontier. So a title can be BORN knowing what has aired, instead of
 * waiting for a sync to tell it. (The nightly job stays the authority: it re-counts per episode,
 * which survives the odd gap TMDB leaves in a season.)
 */
export function airedFromTmdb(
  seasons: { season_number: number; episode_count: number }[],
  lastAired: { season_number: number; episode_number: number } | null | undefined,
): number[] {
  const real = seasons.filter((s) => s.season_number > 0).sort((a, b) => a.season_number - b.season_number);
  // No last_episode_to_air at all → nothing has been broadcast. Not "we don't know": TMDB is
  // saying the show hasn't started.
  if (!lastAired) return real.map(() => 0);

  return real.map((s) => {
    if (s.season_number < lastAired.season_number) return s.episode_count ?? 0;
    if (s.season_number === lastAired.season_number) return lastAired.episode_number ?? 0;
    return 0;   // announced, not out
  });
}

/** A show is over when no episode will ever be added. Cancelled counts — it's still the end. */
export function isFinished(status: string | null | undefined): boolean {
  const s = (status ?? "").toLowerCase();
  return s === "ended" || s === "canceled" || s === "cancelled";
}

/** Episodes that have aired, in total. */
export function airedCount(m: SeriesFacts): number {
  return (m.season_aired ?? []).reduce((a, b) => a + (b || 0), 0);
}

/** Episodes you've been through: every season behind you, plus your place in the current one. */
export function watchedCount(m: SeriesFacts): number {
  const aired = m.season_aired ?? [];
  const season = m.current_season ?? 1;
  const before = aired.slice(0, Math.max(0, season - 1)).reduce((a, b) => a + (b || 0), 0);
  // Clamp: a stale position can claim more episodes of the current season than have aired.
  const inCurrent = Math.min(m.current_episode ?? 0, aired[season - 1] ?? 0);
  return before + Math.max(0, inCurrent);
}

/**
 * Where you stand. `null` when we have no airing data yet (a title added before the sync ever
 * ran) — the caller must degrade, not guess.
 */
export function seriesState(m: SeriesFacts): SeriesState | null {
  const aired = airedCount(m);
  if (aired === 0) return null;

  const seen = watchedCount(m);

  if (seen < aired) {
    // Being behind is ordinary. Being behind AFTER having been caught up is news: something
    // came out while you were waiting, and that's the one thing worth lighting the card up for.
    return m.caught_up_at ? "new" : "watching";
  }

  // You've seen everything that aired. Is that everything there will ever BE?
  return isFinished(m.status) ? "completed" : "caught-up";
}

// ── The next step, and what the app will and won't let you do ──────────────────────────────

export type NextStep =
  | { kind: "episode"; season: number; episode: number }   // next episode, same season
  | { kind: "season"; season: number; episode: number }    // rolls into the next season
  | { kind: "finish" }                                     // everything aired, and it's over
  | { kind: "caught-up" }                                  // everything aired, but it isn't over
  | null;                                                  // no airing data → we don't guess

/**
 * "+1" can never take you past the last episode that has AIRED. You cannot declare you watched
 * an episode that does not exist — the button stops being a "+1" and starts telling the truth.
 */
export function nextStep(m: SeriesFacts): NextStep {
  const aired = m.season_aired ?? [];
  if (aired.length === 0) return null;

  const state = seriesState(m);
  if (state === "completed") return { kind: "finish" };
  if (state === "caught-up") return { kind: "caught-up" };

  const season = m.current_season ?? 1;
  const episode = m.current_episode ?? 0;
  const airedHere = aired[season - 1] ?? 0;

  if (episode < airedHere) return { kind: "episode", season, episode: episode + 1 };

  // Season finished. Find the next season that has actually aired something — an announced
  // season with zero episodes is not a destination (the library has one: The Gentlemen [8, 0]).
  for (let s = season + 1; s <= aired.length; s++) {
    if ((aired[s - 1] ?? 0) > 0) return { kind: "season", season: s, episode: 1 };
  }

  // Nothing left that has aired.
  return isFinished(m.status) ? { kind: "finish" } : { kind: "caught-up" };
}

/**
 * WHAT you're waiting for, when you're caught up. Two very different waits, and calling both
 * "waiting on the next season" is a lie half the time: House of the Dragon has 4 of season 3's
 * 8 episodes out, so at E4 you're waiting a WEEK, not a year.
 */
export function caughtUpOn(m: SeriesFacts): "episode" | "season" {
  const season = m.current_season ?? 1;
  const announced = (m.season_episodes ?? [])[season - 1] ?? 0;
  const aired = (m.season_aired ?? [])[season - 1] ?? 0;
  // The season you're in is still coming out → the next EPISODE is what's missing.
  return aired < announced ? "episode" : "season";
}

/** The last season that has aired anything — "+1" and the season stepper may never exceed it. */
export function lastAiredSeason(m: SeriesFacts): number {
  const aired = m.season_aired ?? [];
  for (let s = aired.length; s >= 1; s--) if ((aired[s - 1] ?? 0) > 0) return s;
  return 1;
}

/** Episodes AIRED in a given season — the ceiling for the episode stepper. */
export function airedInSeason(m: SeriesFacts, season: number): number {
  return (m.season_aired ?? [])[season - 1] ?? 0;
}

/**
 * The years/ratings you may CLAIM, given where you stand.
 *
 * `season_years` and `season_ratings` are maps that only ever GROW. Step your position back —
 * because you corrected a mistake, or un-dropped a show — and the stamps for seasons you no
 * longer claim just stay there. One-Punch Man: you moved back to season 1, and "Last watched"
 * kept reading 2019, the year of a season 2 you weren't claiming any more.
 *
 * We do NOT delete the data: your season 2 in 2019 is a true fact, and it comes back the moment
 * you advance again. We simply stop READING a stamp for a season you haven't reached. Derive,
 * don't store — the same rule as everywhere else in this file.
 */
export function reachedEntries(
  m: SeriesFacts & { watched?: boolean },
  map: Record<string, number> | null | undefined,
): number[] {
  return Object.entries(map ?? {})
    .filter(([season]) => hasReachedSeason(m, Number(season)))
    .map(([, value]) => value)
    .filter((v) => typeof v === "number");
}

/**
 * Have you reached this SEASON? (Not this episode — the season.)
 *
 * ⚠️ THIS IS A DIFFERENT QUESTION FROM `hasReached`, and conflating them was a bug. A season
 * stamp belongs to the season you're IN, not only to the ones behind you: at S1 E0 the Watch
 * History showed your 2017 badge (rule: `season <= position`) while Quick Stats ignored it
 * (rule: you must have watched at least one episode) and fell back on a stale 2019. Two rules,
 * two truths, one screen. Only one may survive — this one.
 */
export function hasReachedSeason(m: SeriesFacts & { watched?: boolean }, season: number): boolean {
  return !!m.watched || season <= (m.current_season ?? 1);
}

/**
 * When did you last watch this?
 *
 * Two sources, and the RIGHT one depends on where you stand:
 *   · Your current season carries a YEAR → you finished it, in that year. Done. A season's year
 *     always beats a timestamp, because a timestamp only records when you clicked. Correcting a
 *     position with the stepper is a FORWARD move, so it dates itself "today" — which is how
 *     One-Punch Man came to claim you'd watched it on 13 July 2026, three corrections after the
 *     fact. The year you actually finished season 2 was sitting right there: 2019.
 *   · No year on your current season → you're in the MIDDLE of it, and nothing but the timestamp
 *     knows anything. That's the case the timestamp was created for (House of the Dragon: you
 *     watched an episode last week, and no season has ended to record it).
 *
 * Returns a Date for the timestamp case, a year for the season case, or null — never a guess.
 */
export function lastWatched(
  m: SeriesFacts & { watched?: boolean; last_watched_at?: string | null; season_years?: Record<string, number> | null },
): { kind: "date"; value: string } | { kind: "year"; value: number } | null {
  const years = reachedEntries(m, m.season_years);
  const currentSeasonYear = (m.season_years ?? {})[String(m.current_season ?? 1)];

  // Mid-season: only the timestamp knows.
  if (currentSeasonYear == null && m.last_watched_at) {
    return { kind: "date", value: m.last_watched_at };
  }
  if (years.length) return { kind: "year", value: Math.max(...years) };
  if (m.last_watched_at) return { kind: "date", value: m.last_watched_at };
  return null;
}

/** Have you got here? Everything behind your position, and everything if you finished the show. */
export function hasReached(
  m: SeriesFacts & { watched?: boolean },
  season: number,
  episode: number,
): boolean {
  if (m.watched) return true;
  const s = m.current_season ?? 1;
  const e = m.current_episode ?? 0;
  return season < s || (season === s && episode <= e);
}

/**
 * Can this episode be rated, starred, marked as a best episode?
 *
 * TWO conditions, and both are needed:
 *   · it has AIRED   — the world's condition. HotD season 3 has four episodes out; 5-8 are
 *     announced, don't exist, and unlock on their air date, by themselves.
 *   · you've REACHED it — your condition. True Detective's seasons 2-4 are locked in Watch
 *     History (you can't date or score them), yet the episode rail happily let you star any
 *     episode inside them. The app was bolting the season door and leaving its windows open.
 *
 * A rating is a VERDICT, not a bookmark — and "best episode" more so. Scoring an episode you
 * haven't seen isn't freedom, it's the exact class of false claim this whole model exists to
 * prevent. (Titles and stills stay visible: the display is unchanged, only the actions close.)
 */
export function isEpisodeActionable(
  m: SeriesFacts & { watched?: boolean },
  season: number,
  episode: number,
): boolean {
  const airedHere = (m.season_aired ?? [])[season - 1] ?? 0;
  const aired = episode >= 1 && episode <= airedHere;
  return aired && hasReached(m, season, episode);
}

/** The last position that exists in the world — what "+1" may never exceed. */
export function lastAiredPosition(m: SeriesFacts): { season: number; episode: number } | null {
  const aired = m.season_aired ?? [];
  for (let s = aired.length; s >= 1; s--) {
    const n = aired[s - 1] ?? 0;
    if (n > 0) return { season: s, episode: n };
  }
  return null;
}

/**
 * Has this season FULLY AIRED? (The world's half of the question.)
 * Stamping a year on a season still coming out would date a memory you haven't had.
 */
export function isSeasonComplete(m: SeriesFacts, season: number): boolean {
  const announced = (m.season_episodes ?? [])[season - 1] ?? 0;
  const aired = (m.season_aired ?? [])[season - 1] ?? 0;
  return announced > 0 && aired >= announced;
}

/** Have you watched this season to its LAST episode? (Your half of the question.) */
export function hasFullyWatchedSeason(m: SeriesFacts & { watched?: boolean }, season: number): boolean {
  if (m.watched) return true;
  const current = m.current_season ?? 1;
  if (season < current) return true;
  if (season > current) return false;
  const announced = (m.season_episodes ?? [])[season - 1] ?? 0;
  return announced > 0 && (m.current_episode ?? 0) >= announced;
}

/**
 * May this season carry a WATCH YEAR? Both halves must be true: it has fully aired, and you
 * have watched it to the end. A year is a fact about a FINISHED season.
 *
 * ONE rule, exported, because the app kept inventing a second one. "Set all year" applied a year
 * to every season that wasn't visibly locked — including House of the Dragon's season 3, four
 * episodes out of eight. And the season strip's own badge used a THIRD rule ("is it behind my
 * position"), which called season 4 of FROM undatable even though it had fully aired and you'd
 * watched every episode of it. Two rules on one screen is how you get two answers.
 */
export function isSeasonDatable(m: SeriesFacts & { watched?: boolean }, season: number): boolean {
  return isSeasonComplete(m, season) && hasFullyWatchedSeason(m, season);
}

/**
 * `caught_up_at` — the stamp that makes "New episodes" possible, and the reason the sync job
 * can light a card up at all.
 *
 * It records that you STOOD AT THE FRONTIER: you'd seen everything that existed. When the nightly
 * sync then raises `season_aired`, `seriesState` sees `seen < aired` WITH this stamp set and says
 * "new" instead of a flat "watching" — the difference between "you're behind" and "something came
 * out while you were waiting".
 *
 * It was written once, at add time, and nowhere else — so a title you caught up to by tapping "+1"
 * never got it, and would never have lit up. Every write of a POSITION must recompute it, which is
 * exactly why it's a function of the facts rather than a flag somebody remembers to set.
 *
 * Moving BACKWARDS clears it: stepping away from the frontier by your own hand is not news.
 */
export function caughtUpAt(m: SeriesFacts, existing?: string | null): string | null {
  const state = seriesState(m);
  const atFrontier = state === "caught-up" || state === "completed";
  // Keep the ORIGINAL stamp: it marks when you got there, not when you last looked.
  return atFrontier ? (existing ?? new Date().toISOString()) : null;
}
