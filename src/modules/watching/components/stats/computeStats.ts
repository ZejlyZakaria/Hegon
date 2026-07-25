import type { StatsRawItem, RewatchStatItem } from "../../service";
import type { Achievement } from "@/shared/components/achievements/types";
import { buildMediaView, type MediaView } from "../../lib/media-view";
import type { AnimeCoursRow } from "../../types";

/**
 * ⚠️ THIS PAGE SPEAKS DISPLAY SPACE, NOT STORAGE SPACE.
 *
 * It used to read the raw columns, and that made it lie about every anime TMDB lumps into one
 * season. Jujutsu Kaisen is stored as `season_episodes: [59]` with `season_years: {}` — the three
 * years you actually stamped live in `cour_years: {1:2021, 2:2024, 3:2026}`, because a map keyed by
 * TMDB season cannot say "the second of three cours inside season 1". Finding no stamps, this file
 * fell back to `updated_at` and filed all 59 episodes under the year you last touched the row.
 * Three years of watching, collapsed into one, on the page whose entire job is to date things.
 *
 * `media-view.ts` warns that the surfaces most likely to forget the overlay are the ones locked out
 * of the thing that prevents it. This was that surface. Every helper below now takes the VIEW.
 */
type ViewOf = (i: StatsRawItem) => MediaView;

function makeViewOf(cours: Map<number, AnimeCoursRow>): ViewOf {
  const cache = new Map<string, MediaView>();
  return (i) => {
    const hit = cache.get(i.id);
    if (hit) return hit;
    // `type` is a plain string on the row and a union on the lens's input — same values, and the
    // lens only ever compares it to "anime".
    const view = buildMediaView(i as Parameters<typeof buildMediaView>[0], i.tmdb_id ? cours.get(i.tmdb_id) : undefined);
    cache.set(i.id, view);
    return view;
  };
}

/**
 * ONE TITLE'S SHARE OF A TOTAL — what the Hours Watched panel shows when you open a slice.
 *
 * A total is a claim you have to take on faith; this is the working. It exists because a title
 * worth zero hours is invisible in a sum: `Elite` was billed 0 h for two days, and the only way
 * anyone could notice was by feeling that a number looked small.
 */
export interface HoursEntry {
  item: StatsRawItem;
  /** Episodes counted for the selected period. A film is one sitting. */
  episodes: number;
  /** Minutes per sitting. `null` means TMDB never told us — NOT zero, which would be a claim. */
  runtime: number | null;
  /** What this title contributed. Zero exactly when the runtime is unknown. */
  minutes: number;
  /**
   * WHICH season this year was, and its own artwork — the same pair Top Picks shows, for the same
   * reason: in a year view you did not watch "Jujutsu Kaisen", you watched one part of it, and the
   * row should say which and wear its cover. Null in an all-time view, or when the year covers
   * several seasons (there is no single thing to name).
   */
  seasonLabel: string | null;
  seasonPoster: string | null;
}

/** A rewatch is an EVENT, not an aggregate: it has a date, and it reads in time order. */
export interface RewatchEntry {
  item: StatsRawItem;
  watchedOn: string;
  minutes: number;
}

export interface ComputedStats {
  availableYears: number[];
  counts: { film: number; serie: number; anime: number; total: number };
  // Per-type status split of the counted shows (watched / in progress / paused / dropped).
  statusCounts: {
    serie: { watched: number; inProgress: number; paused: number; dropped: number };
    anime: { watched: number; inProgress: number; paused: number; dropped: number };
  };
  rewatches: number;  // rewatch events in the period (they add hours, not unique titles)
  // Hours Watched — rewatch time is its own 4th slice (pulled out of the per-type
  // hours), so the donut shows "how much of my time was re-watching".
  hours: { film: number; serie: number; anime: number; rewatches: number; total: number };
  /**
   * The same numbers as `hours`, itemised. Derived from the SAME pass, not recomputed — a second
   * derivation of one figure is how the module lost 60 hours in the first place.
   * Sorted by contribution (aggregates) or by date, newest first (rewatches).
   */
  breakdown: {
    film: HoursEntry[];
    serie: HoursEntry[];
    anime: HoursEntry[];
    rewatches: RewatchEntry[];
  };
  avgRating: number | null;
  ratedCount: number;
  topGenres: { name: string; count: number }[];
  ratingDistribution: { score: number; count: number }[];
  topFavorites: { item: StatsRawItem; seasonLabel: string | null; rating: number | null; seasonPoster: string | null }[];
  wrappedPosters: StatsRawItem[];
  activity: { label: string; count: number }[];
  streaks: {
    bestMonth: { label: string; count: number } | null;
    activeMonthsCount: number;
    bestYear: { label: string; count: number } | null;
  };
}

/**
 * Minutes → hours, EXACT.
 *
 * This used to round to a tenth of an hour, which is six minutes of slack — invisible while the
 * only consumer printed one figure, and immediately visible the moment a panel listed the rows
 * behind it: the card said "200h 42m" over a list that summed to 200h 39m. A number you can open
 * has to survive being added up, so the rounding moves to the last possible moment (the h/m split
 * at render) instead of being baked into the value.
 *
 * The donut is unaffected: it reads ratios, and a ratio does not care about the unit.
 */
function toH(min: number) {
  return min / 60;
}

// Fallback year, used ONLY when a season carries no explicit stamp: finish date (watched_at) when
// completed, last-progress (updated_at) otherwise. This is the loose last resort — the honest year
// of a season/cour lives in `season_years`/`cour_years`, edited in ONE place (Watch History for a
// multi-season title, the StatusCard year picker for a single one). A parallel `caught_up_at` path
// was tried here and reverted: it made Stats read a second source for a fact that must have one.
function fallbackYearOf(i: StatsRawItem): number | null {
  const d = i.watched ? i.watched_at : i.updated_at;
  return d ? new Date(d).getFullYear() : null;
}

// SINGLE SOURCE OF TRUTH for which year a season is attributed to — used by hours,
// counts, Top Picks AND the activity timeline, so they can never disagree.
// `view.yearMap` is `cour_years` under the overlay and `season_years` otherwise: one read, right
// column, whichever space the title lives in.
function seasonYearOf(v: MediaView, i: StatsRawItem, season: number): number | null {
  return v.yearMap?.[String(season)] ?? fallbackYearOf(i);
}

// Whether a completed season should be counted, and in which year. When a show
// has ANY explicit per-season year (stamps), we TRUST them: only stamped seasons
// count — unstamped ones (e.g. a future season TMDB lists, or one you didn't
// watch) are ignored. Only a fully-legacy show (zero stamps) falls back to
// watched_at/updated_at for all its seasons.
function countedSeasonYear(v: MediaView, i: StatsRawItem, season: number): number | null {
  const stamped = v.yearMap?.[String(season)];
  if (stamped != null) return stamped;
  const hasStamps = Object.keys(v.yearMap ?? {}).length > 0;
  return hasStamps ? null : fallbackYearOf(i);
}

// Per-season hour contributions of a series/anime: each counted season's episodes
// attributed to its year. Completed → counted seasons; in-progress → finished
// counted seasons + the current season's watched episodes (always counted, live).
function seasonContributions(v: MediaView, i: StatsRawItem): { episodes: number; year: number | null }[] {
  // WHAT AIRED, not what was announced. This page billed you for episodes that do not exist:
  // "watched" a show whose next season is already listed on TMDB and it counted that season's
  // hours, and the current-season clamp was against the announced count too. So the same title
  // reported one number of hours on the detail page and another here — the module's oldest disease,
  // surviving in the one place nobody looked. (Rows the sync hasn't reached fall back, loosely.)
  //
  // And the seasons are the VIEW's — three cours for Jujutsu Kaisen, not TMDB's single lump of 59.
  // Reading the raw column here is what put three years of watching into one.
  const seasons = v.seasons.map((s) => (s.aired > 0 ? s.aired : s.episodes));

  // No per-season breakdown → single bucket on the title's year.
  if (seasons.length === 0) {
    const eps = i.watched ? (i.episodes ?? 0) : (v.position.episode ?? 0);
    return [{ episodes: eps, year: seasonYearOf(v, i, 1) }];
  }

  const out: { episodes: number; year: number | null }[] = [];

  if (i.watched) {
    seasons.forEach((eps, idx) => {
      const y = countedSeasonYear(v, i, idx + 1);
      if (y != null) out.push({ episodes: eps, year: y });
    });
    return out;
  }

  // In-progress: finished counted seasons + current season (clamped, always live). The position is
  // the view's too — a lumped anime stores "episode 47" and shows "cour 3, episode 1".
  const cs = v.position.season || 1;
  const ce = Math.min(v.position.episode ?? 0, seasons[cs - 1] ?? (v.position.episode ?? 0));
  for (let s = 1; s < cs; s++) {
    const y = countedSeasonYear(v, i, s);
    if (y != null) out.push({ episodes: seasons[s - 1] ?? 0, year: y });
  }
  out.push({ episodes: ce, year: v.yearMap?.[String(cs)] ?? fallbackYearOf(i) });
  return out;
}

// Years a series/anime actually contributed WATCHED EPISODES to (incl. the current
// in-progress season). Same source as the hours, so counts/activity always agree
// with Hours Watched: if you watched episodes in a year, the title counts there.
function contributionYears(v: MediaView, i: StatsRawItem): number[] {
  return seasonContributions(v, i)
    .filter((c) => c.episodes > 0 && c.year != null)
    .map((c) => c.year as number);
}

// An item contributes real watch time if it's completed OR has partial progress —
// including paused and dropped shows: the episodes you actually watched are real
// hours regardless of the current status. `want_to_watch`/reference have no progress.
function hasWatchTime(i: StatsRawItem): boolean {
  return !!(i.watched || i.in_progress || i.paused || i.dropped);
}

// Does a title count toward a type/year total?
//  • Films: watched (in that year for a year filter).
//  • Series/anime ALL-TIME: your library — anything you spent time on (watched, in
//    progress, paused, or dropped), so a show on season 1 still counts.
//  • Series/anime PER-YEAR: it watched episodes that year (same as the hours).
function countsTitle(v: MediaView, i: StatsRawItem, year: number | null): boolean {
  if (i.type === "film") {
    if (!i.watched) return false;
    if (!year) return true;
    return !!i.watched_at && new Date(i.watched_at).getFullYear() === year;
  }
  if (!year) return hasWatchTime(i);
  if (!hasWatchTime(i)) return false;
  return contributionYears(v, i).includes(year);
}

// Mirror the Watch History lock: on an in-progress series you've only REACHED the
// current season, so any season stamped beyond it is stale (e.g. you bumped the
// current season to 10 to test, then reverted to 9 — the season-10 stamp lingers).
// Stats must ignore those so a show isn't labelled "Seasons 1–10" when you're on 9.
function isSeasonWatched(v: MediaView, i: StatsRawItem, season: number): boolean {
  if (!i.watched && v.position.season) return season <= v.position.season;
  return true;
}
// season→year stamps, minus any season you haven't actually reached. Display space: `cour_years`
// under the overlay, `season_years` otherwise.
function watchedSeasonYears(v: MediaView, i: StatsRawItem): [number, number][] {
  return Object.entries(v.yearMap ?? {})
    .map(([s, y]) => [Number(s), y] as [number, number])
    .filter(([s]) => isSeasonWatched(v, i, s));
}

// The season's own poster for the year shown — only when a SINGLE season
// represents that year on a multi-year show (so the thumbnail matches the
// labelled season). Otherwise null → fall back to the show poster.
export function seasonPosterFor(v: MediaView, i: StatsRawItem, year: number | null): string | null {
  if (!year || i.type === "film") return null;
  const wy = watchedSeasonYears(v, i);
  const isMultiYear = new Set(wy.map(([, y]) => y)).size >= 2;
  if (!isMultiYear) return null;
  const seasonsInY = wy.filter(([, y]) => y === year).map(([s]) => s);
  if (seasonsInY.length !== 1) return null;
  // The view's posters: a cour carries its OWN artwork from AniList, which is the whole reason a
  // year of Jujutsu Kaisen can show the right cover instead of the franchise's.
  //
  // Returned READY TO USE. `ViewSeason.poster` is two different things — an absolute AniList URL
  // for a cour, a bare TMDB path for a season — and every call site was pasting a TMDB prefix in
  // front of whatever it got. That silently breaks the moment the cours arrive, which is exactly
  // the change being made here, so the normalisation belongs once, in the function that knows.
  const poster = v.seasons[seasonsInY[0] - 1]?.poster ?? null;
  if (!poster) return null;
  return poster.startsWith("http") ? poster : `https://image.tmdb.org/t/p/w500${poster}`;
}

// For a given year, which season(s) of this title were watched → "Season 3",
// "Seasons 1–8", or null (film / legacy / all-time → show the whole title).
export function seasonLabelFor(v: MediaView, i: StatsRawItem, year: number | null): string | null {
  if (!year || i.type === "film") return null;
  const seasons = watchedSeasonYears(v, i)
    .filter(([, y]) => y === year)
    .map(([s]) => s)
    .sort((a, b) => a - b);
  if (seasons.length === 0) return null;
  /**
   * "Season", including for a cour. This briefly said "Part" under the overlay, on the argument
   * that a cour is not a TMDB season — a purity that contradicted the app: `StatusCard` prints
   * "Season 2 · Episode 1" for a lumped anime and `SeasonHistoryStrip` labels every tile "Season N".
   * Inventing a second noun here would have made this page the only one speaking it, and split the
   * vocabulary between two kinds of anime for a distinction the reader never asked to see.
   */
  if (seasons.length === 1) return `Season ${seasons[0]}`;
  const contiguous = seasons.every((s, idx) => idx === 0 || s === seasons[idx - 1] + 1);
  return contiguous ? `Seasons ${seasons[0]}–${seasons[seasons.length - 1]}` : `${seasons.length} seasons`;
}

// Rating to rank/show a title by for a given year. Smart filter: if the whole
// show was watched in a SINGLE year (all seasons same year), use the title's
// overall rating — even if seasons were rated individually. Only when the show
// spans MULTIPLE years do we use the rating of the season watched that year.
// Films and all-time always use the title rating.
function effectiveRating(v: MediaView, i: StatsRawItem, year: number | null): number | null {
  if (i.type === "film" || !year) return i.user_rating;
  const wy = watchedSeasonYears(v, i);
  const isMultiYear = new Set(wy.map(([, y]) => y)).size >= 2;
  if (!isMultiYear) return i.user_rating;
  const seasonsInY = wy.filter(([, y]) => y === year).map(([s]) => s);
  const ratings = seasonsInY
    .map((s) => v.ratingMap?.[String(s)])
    .filter((r): r is number => r != null);
  if (ratings.length === 0) return i.user_rating;
  return Math.max(...ratings);
}

export function computeStats(
  items: StatsRawItem[],
  rewatches: RewatchStatItem[],
  year: number | null,
  /** tmdb_id → AniList cours. Omit and every title is read in its stored coordinates. */
  cours: Map<number, AnimeCoursRow> = new Map(),
): ComputedStats {
  // ONE lens per title, built once and shared by every helper below, so no two cards on this page
  // can end up reasoning in different coordinate spaces.
  const viewOf = makeViewOf(cours);

  // Completed titles (used for the available-year list below).
  const completed = items.filter((i) => i.watched);

  // The titles that belong to the selected period — all-time = your library
  // (watched OR in progress), per-year = season-aware (episodes watched that
  // year). SINGLE source for counts, genres, ratings AND wrapped, so every card
  // in a year view talks about the exact same set of titles.
  const periodItems = items.filter((i) => countsTitle(viewOf(i), i, year));
  const counts = {
    film:  periodItems.filter((i) => i.type === "film").length,
    serie: periodItems.filter((i) => i.type === "serie").length,
    anime: periodItems.filter((i) => i.type === "anime").length,
    total: periodItems.length,
  };
  const statusOf = (type: "serie" | "anime") => {
    const of = periodItems.filter((i) => i.type === type);
    return {
      watched:    of.filter((i) => i.watched).length,
      inProgress: of.filter((i) => i.in_progress).length,
      paused:     of.filter((i) => i.paused).length,
      dropped:    of.filter((i) => i.dropped).length,
    };
  };
  const statusCounts = { serie: statusOf("serie"), anime: statusOf("anime") };

  // Hours Watched — completed films + series/anime episodes ACTUALLY watched (full
  // when completed, current progress when in-progress), each × the real runtime.
  // ITEMISED FIRST, SUMMED SECOND. The panel that explains a slice and the slice itself must be
  // the same arithmetic — so the entries are what gets built, and the total is their sum. Computing
  // a total here and a breakdown elsewhere is exactly the shape of the bug that lost 60 hours.
  const byMinutes = (a: { minutes: number }, b: { minutes: number }) => b.minutes - a.minutes;

  const filmEntries: HoursEntry[] = items
    .filter((i) => i.type === "film" && i.watched && (!year || fallbackYearOf(i) === year))
    .map((i) => ({
      item: i, episodes: 1, runtime: i.runtime ?? null, minutes: i.runtime ?? 0,
      seasonLabel: null, seasonPoster: null,
    }))
    .sort(byMinutes);

  // Series/anime: distribute each season's episodes to ITS year, then keep the
  // ones matching the filter. This is why the year total is now accurate per show.
  const tvEntries = (type: string): HoursEntry[] =>
    items
      .filter((i) => i.type === type && hasWatchTime(i))
      .map((i) => {
        const v = viewOf(i);
        const episodes = seasonContributions(v, i)
          .filter((c) => !year || c.year === year)
          .reduce((a, c) => a + c.episodes, 0);
        return {
          item: i, episodes, runtime: i.runtime ?? null, minutes: episodes * (i.runtime ?? 0),
          seasonLabel: seasonLabelFor(v, i, year),
          seasonPoster: seasonPosterFor(v, i, year),
        };
      })
      // No episodes in the period → the title has nothing to say here. A title WITH episodes and
      // no known runtime stays: it contributes zero, and that is the thing worth seeing.
      .filter((e) => e.episodes > 0)
      .sort(byMinutes);

  const serieEntries = tvEntries("serie");
  const animeEntries = tvEntries("anime");

  const sumMinutes = (es: { minutes: number }[]) => es.reduce((s, e) => s + e.minutes, 0);
  const filmMin = sumMinutes(filmEntries);
  const serieMin = sumMinutes(serieEntries);
  const animeMin = sumMinutes(animeEntries);

  // Rewatches — each event = re-watched the whole title → its full runtime, on the
  // event's year. Adds to Hours Watched (real time spent); does NOT bump the unique-
  // title counts (same title) nor Recently Watched.
  const itemById = new Map(items.map((i) => [i.id, i]));
  // AIRED, not announced — the same rule `seasonContributions` states above, which this line
  // quietly broke. Re-watching a running series means re-watching what EXISTS of it; billing the
  // announced count charged you for episodes nobody has seen, and made the rewatch slice of the
  // donut disagree with the per-type slices computed right beside it.
  const totalEps = (i: StatsRawItem) =>
    (i.season_aired ?? i.season_episodes)?.reduce((a, b) => a + (b || 0), 0) || i.episodes || 0;
  let rewatchCount = 0;
  const rewatchMin = { film: 0, serie: 0, anime: 0 };
  const rewatchEntries: RewatchEntry[] = [];
  for (const rw of rewatches) {
    if (year && new Date(rw.watched_on).getFullYear() !== year) continue;
    rewatchCount++;
    const it = itemById.get(rw.media_item_id);
    if (!it) continue;
    const rt = it.runtime ?? 0;
    const min = it.type === "film" ? rt : totalEps(it) * rt;
    rewatchEntries.push({ item: it, watchedOn: rw.watched_on, minutes: min });
    if (it.type === "film") rewatchMin.film += min;
    else if (it.type === "serie") rewatchMin.serie += min;
    else if (it.type === "anime") rewatchMin.anime += min;
  }
  // An event log reads in time order, newest first — ranking it by size would be reading it wrong.
  rewatchEntries.sort((a, b) => b.watchedOn.localeCompare(a.watchedOn));

  const rewatchMinTotal = rewatchMin.film + rewatchMin.serie + rewatchMin.anime;
  const hours = {
    film:  toH(filmMin),
    serie: toH(serieMin),
    anime: toH(animeMin),
    rewatches: toH(rewatchMinTotal),
    total: toH(filmMin + serieMin + animeMin + rewatchMinTotal),
  };

  // Ratings — season-aware: each period title contributes the rating that applies
  // for the period (the season's rating in a year view of a multi-year show, else
  // the title rating). Same source as the counts, so avg/dist match what's shown.
  const periodRatings = periodItems
    .map((i) => effectiveRating(viewOf(i), i, year))
    .filter((r): r is number => r != null);
  const avgRating = periodRatings.length > 0
    ? Math.round((periodRatings.reduce((s, r) => s + r, 0) / periodRatings.length) * 10) / 10
    : null;

  const genreCount: Record<string, number> = {};
  for (const item of periodItems) {
    for (const tag of item.tags ?? []) {
      genreCount[tag] = (genreCount[tag] ?? 0) + 1;
    }
  }
  const topGenres = Object.entries(genreCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6)
    .map(([name, count]) => ({ name, count }));

  const dist: Record<number, number> = {};
  for (const r of periodRatings) {
    const bucket = Math.round(r);
    if (bucket >= 1 && bucket <= 10) dist[bucket] = (dist[bucket] ?? 0) + 1;
  }
  const ratingDistribution = Array.from({ length: 10 }, (_, i) => ({
    score: i + 1,
    count: dist[i + 1] ?? 0,
  }));

  // Top Picks — season-aware: a show appears in the year it had a season watched,
  // labelled with that season (e.g. JJK in 2026 → "Season 3"), ranked by the
  // season's own rating when set, else the title rating.
  const topFavorites = items
    .map((item) => {
      const v = viewOf(item);
      return {
        item,
        rating: effectiveRating(v, item, year),
        seasonLabel: seasonLabelFor(v, item, year),
        seasonPoster: seasonPosterFor(v, item, year),
      };
    })
    .filter((x) => countsTitle(viewOf(x.item), x.item, year) && (x.item.favorite || (x.rating ?? 0) >= 8))
    .sort((a, b) => {
      // Rank by YOUR rating first — a 9.0 must beat a 7.5 even if the 7.5 is a
      // favorite. Favorite is only a tiebreaker between equal ratings.
      const byRating = (b.rating ?? 0) - (a.rating ?? 0);
      if (byRating !== 0) return byRating;
      if (a.item.favorite !== b.item.favorite) return a.item.favorite ? -1 : 1;
      return 0;
    })
    .slice(0, 6);

  const wrappedPosters = [...periodItems]
    .filter((i) => i.poster_url)
    .sort((a, b) => {
      if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
      return (effectiveRating(viewOf(b), b, year) ?? 0) - (effectiveRating(viewOf(a), a, year) ?? 0);
    })
    .slice(0, 3)
    // Use the season's own poster for the year when it resolves to a single season (e.g. MHA S8),
    // matching Top Picks — else fall back to the show poster. Already a full URL.
    .map((i) => ({ ...i, poster_url: seasonPosterFor(viewOf(i), i, year) ?? i.poster_url }));

  const availableYears = [
    ...new Set([
      ...completed.filter((i) => i.watched_at).map((i) => new Date(i.watched_at!).getFullYear()),
      ...items.filter((i) => i.in_progress && i.updated_at).map((i) => new Date(i.updated_at!).getFullYear()),
      // The stamps, in whichever space the title keeps them — a year you only ever recorded on a
      // cour was missing from this list entirely.
      ...items.flatMap((i) => Object.values(viewOf(i).yearMap ?? {})),
    ]),
  ].sort((a, b) => b - a);

  // Activity — a real per-YEAR timeline (month-level data doesn't exist for
  // backfilled shows, and we never fabricate it). Each completed season counts in
  // its seasonYearOf; films in their watched_at year. Always yearly (the StatsPage
  // highlights the selected year). Counts watching "events" (films + seasons).
  const activityCounts: Record<number, number> = {};
  const bumpYear = (y: number) => { activityCounts[y] = (activityCounts[y] ?? 0) + 1; };
  for (const item of items) {
    if (item.type === "film") {
      if (item.watched && item.watched_at) bumpYear(new Date(item.watched_at).getFullYear());
    } else if (hasWatchTime(item)) {
      // `hasWatchTime`, not `watched || in_progress`: a paused or dropped show already contributes
      // its hours AND its title count through that very predicate, so leaving it out here made the
      // timeline the one card that disagreed with the rest of the page — the exact opposite of what
      // `contributionYears` promises above. The episodes you watched happened, whatever you did next.
      for (const y of contributionYears(viewOf(item), item)) bumpYear(y);
    }
  }
  const activity = Object.keys(activityCounts).map(Number).sort((a, b) => a - b)
    .map((y) => ({ label: String(y), count: activityCounts[y] }));

  // Streaks — computed from all-time items (not filtered by year)
  const MONTHS_FULL = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const monthCounts: Record<string, number> = {};
  for (const item of items) {
    if (!item.watched_at) continue;
    const d = new Date(item.watched_at);
    const key = `${MONTHS_FULL[d.getMonth()]} ${d.getFullYear()}`;
    monthCounts[key] = (monthCounts[key] ?? 0) + 1;
  }
  const monthEntries = Object.entries(monthCounts).sort(([, a], [, b]) => b - a);
  const bestMonth = monthEntries[0]
    ? { label: monthEntries[0][0], count: monthEntries[0][1] }
    : null;
  const activeMonthsCount = monthEntries.length;

  const yearCountsAll: Record<string, number> = {};
  for (const item of items) {
    if (!item.watched_at) continue;
    const y = String(new Date(item.watched_at).getFullYear());
    yearCountsAll[y] = (yearCountsAll[y] ?? 0) + 1;
  }
  const yearEntries = Object.entries(yearCountsAll).sort(([, a], [, b]) => b - a);
  const bestYear = yearEntries[0]
    ? { label: yearEntries[0][0], count: yearEntries[0][1] }
    : null;

  return {
    availableYears, counts, statusCounts, rewatches: rewatchCount, hours,
    breakdown: { film: filmEntries, serie: serieEntries, anime: animeEntries, rewatches: rewatchEntries },
    avgRating,
    ratedCount: periodRatings.length,
    topGenres, ratingDistribution, topFavorites, wrappedPosters, activity,
    streaks: { bestMonth, activeMonthsCount, bestYear },
  };
}

// Achievements are computed from ALL-TIME stats (ignore year filter)
/**
 * One binary achievement — locked until `value` reaches `goal`, then done. A single, honest bar to
 * clear; the shared <AchievementGrid> renders it as a badge with a progress bar while locked. No
 * tiers: the owner asked for one level, a set that stays a little hard, and reads at a glance.
 */
function achievement(
  base: { key: string; name: string; icon: Achievement["icon"]; color: string; description: string },
  value: number,
  goal: number,
): Achievement {
  const unlocked = value >= goal;
  return {
    key: base.key,
    name: base.name,
    icon: base.icon,
    color: base.color,
    description: base.description,
    unlocked,
    progress: goal <= 0 ? 1 : Math.min(1, value / goal),
    progressLabel: unlocked ? "Unlocked" : `${value.toLocaleString()} / ${goal.toLocaleString()}`,
  };
}

/**
 * The twelve. Thresholds are calibrated against a real, heavy library (≈270 films, ≈2,800 h) so the
 * set stays *a bit hard* — three already-earned to reward who you are, nine to chase, several sitting
 * near 90 % so there is always a carrot just ahead. `totalHours` is passed in — the SAME all-time
 * figure the Hours Watched donut sums — so Marathoner can never disagree with it.
 */
export function computeAchievements(items: StatsRawItem[], totalHours = 0): Achievement[] {
  const completed = items.filter((i) => i.watched);
  const films    = completed.filter((i) => i.type === "film").length;
  const series   = completed.filter((i) => i.type === "serie").length;
  const animes   = completed.filter((i) => i.type === "anime").length;
  const ninePlus = completed.filter((i) => (i.user_rating ?? 0) >= 9).length;
  const perfect  = completed.filter((i) => (i.user_rating ?? 0) >= 10).length;

  // Breadth — distinct genres explored, and distinct DECADES of release your titles span.
  const genres = new Set<string>();
  const decades = new Set<number>();
  for (const i of completed) {
    for (const tag of i.tags ?? []) genres.add(tag);
    if (i.year) decades.add(Math.floor(i.year / 10) * 10);
  }

  // Depth — the most titles you've watched from a SINGLE director. Directors are an uncapped list
  // (one to a few people), so this ruler is honest — unlike a cast count, which caps at 12.
  const dirCount: Record<number, number> = {};
  for (const i of completed) {
    const seen = new Set<number>();
    for (const p of i.directors ?? []) {
      if (!p?.id || seen.has(p.id)) continue;
      seen.add(p.id);
      dirCount[p.id] = (dirCount[p.id] ?? 0) + 1;
    }
  }
  const maxDirector = Math.max(0, ...Object.values(dirCount));

  // Rhythm — your biggest single calendar year, and how many distinct months you've been present.
  const yearCount: Record<number, number> = {};
  const months = new Set<string>();
  for (const i of completed) {
    if (!i.watched_at) continue;
    const d = new Date(i.watched_at);
    yearCount[d.getFullYear()] = (yearCount[d.getFullYear()] ?? 0) + 1;
    months.add(`${d.getFullYear()}-${d.getMonth()}`);
  }
  const bestYear = Math.max(0, ...Object.values(yearCount));

  // Endurance — the longest series/anime you've FINISHED, in aired (not announced) episodes.
  const totalEps = (i: StatsRawItem) =>
    (i.season_aired ?? i.season_episodes)?.reduce((a, b) => a + (b || 0), 0) || i.episodes || 0;
  const longestShow = Math.max(0, ...completed.filter((i) => i.type !== "film").map(totalEps));

  // Harmonised jewel tones — one cohesive set on graphite, told apart by icon + colour at a glance.
  return [
    achievement({ key: "cinephile",     name: "Cinephile",      icon: "clapperboard",  color: "#2dd4bf", description: "Watch 350 films" },              films,                  350),
    achievement({ key: "series_devotee",name: "Series Devotee", icon: "tv",            color: "#7f9cf5", description: "Finish 30 series" },              series,                 30),
    achievement({ key: "otaku",         name: "Otaku",          icon: "sparkles",      color: "#e6973f", description: "Finish 50 animes" },              animes,                 50),
    achievement({ key: "marathoner",    name: "Marathoner",     icon: "clock",         color: "#e57ba3", description: "Watch 3,000 hours" },             Math.round(totalHours), 3000),
    achievement({ key: "connoisseur",   name: "Connoisseur",    icon: "gem",           color: "#4fc59b", description: "Rate 25 titles 9 or higher" },    ninePlus,               25),
    achievement({ key: "hall_of_fame",  name: "Hall of Fame",   icon: "trophy",        color: "#e8b64c", description: "Award 15 perfect 10s" },          perfect,                15),
    achievement({ key: "time_traveler", name: "Time Traveler",  icon: "calendarRange", color: "#58b0e0", description: "Span 8 decades of release" },     decades.size,           8),
    achievement({ key: "genre_nomad",   name: "Genre Nomad",    icon: "globe",         color: "#a98bf0", description: "Explore 25 genres" },             genres.size,            25),
    achievement({ key: "auteur",        name: "Auteur",         icon: "medal",         color: "#e5776b", description: "Watch 12 by one director" },       maxDirector,            12),
    achievement({ key: "big_year",      name: "Big Year",       icon: "flame",         color: "#db8f5a", description: "Watch 50 in one year" },          bestYear,               50),
    achievement({ key: "long_hauler",   name: "Long Hauler",    icon: "layers",        color: "#6f9ce0", description: "Finish a 100-episode series" },   longestShow,            100),
    achievement({ key: "ever_present",  name: "Ever-Present",   icon: "calendarCheck", color: "#b98fd4", description: "Active across 120 months" },      months.size,            120),
  ];
}
