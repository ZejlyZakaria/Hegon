import { legacyDisplayCounts } from "../../lib/legacy-consumption";
import { periodEpisodeLabel, ratedScopePresentation } from "../../lib/season-history";
import { deduplicateFirstViewing, rangeCount, legacyViewingDate, calendarStats, type CalendarStats, historicalContributions, historicalRatingResult, periodMatches, recordsFor, formatHistoryDate, type HistoryAnalytics, type WatchContribution } from "../../lib/history-analytics";
import { episodeCountsForTime } from "../../lib/episode-counts";
import type { StatsRawItem, RewatchStatItem } from "../../service";
import { buildMediaView, type MediaView } from "../../lib/media-view";
import { isAwaitingNextSeason } from "../../lib/series-state";
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
  source?: "HISTORY" | "LEGACY" | "MIXED";
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
  minutes: number | null;
  scope?: string;
  durationUnknown?: boolean;
}

export interface ComputedStats {
  yearlyStats: CalendarStats[];
  monthlyStats: CalendarStats[];
  dailyStats: CalendarStats[];
  episodes?: number;
  unknownDurationEvents?: number;
  unknownScopeEvents?: number;
  dailyActivity?: { label:string; count:number }[];
  availableYears: number[];
  counts: { film: number; serie: number; anime: number; total: number };
  // Per-type status split of the counted shows (watched / in progress / paused / dropped).
  statusCounts: {
    serie: { watched: number; inProgress: number; caughtUp: number; paused: number; dropped: number };
    anime: { watched: number; inProgress: number; caughtUp: number; paused: number; dropped: number };
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
  if(i.legacy_consumption) return i.legacy_consumption.fallback_year;
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
// have known annual attribution — unstamped ones remain unattributed; their aired viewing still counts all-time. Only a fully-legacy show (zero stamps) falls back to
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
  const seasons = legacyDisplayCounts(i,v) ?? v.seasons.map((s) => (s.airedKnown === false ? s.episodes : s.aired));

  // No per-season breakdown → single bucket on the title's year.
  if (seasons.length === 0) {
    const known = (i.legacy_consumption?.counts ?? episodeCountsForTime(i)).reduce((sum, n) => sum + n, 0);
    const eps = i.watched ? known : i.season_aired != null ? Math.min(v.position.episode ?? 0, known) : (v.position.episode ?? 0);
    return [{ episodes: eps, year: seasonYearOf(v, i, 1) }];
  }

  const out: { episodes: number; year: number | null }[] = [];

  if (i.watched) {
    seasons.forEach((eps, idx) => {
      const y = countedSeasonYear(v, i, idx + 1);
      out.push({ episodes: eps, year: y });
    });
    return out;
  }

  // In-progress: finished counted seasons + current season (clamped, always live). The position is
  // the view's too — a lumped anime stores "episode 47" and shows "cour 3, episode 1".
  const cs = v.position.season || 1;
  const ce = Math.min(v.position.episode ?? 0, seasons[cs - 1] ?? (v.position.episode ?? 0));
  for (let s = 1; s < cs; s++) {
    const y = countedSeasonYear(v, i, s);
    out.push({ episodes: seasons[s - 1] ?? 0, year: y });
  }
  out.push({ episodes: ce, year: v.yearMap?.[String(cs)] ?? fallbackYearOf(i) });
  return out;
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

// Annual series scores require ratings of seasons/cours attributed to that year.
// Activity alone cannot date a title rating. Films and all-time use the title rating.
function effectiveRating(v: MediaView, i: StatsRawItem, year: number | null): number | null {
  if (i.type === "film" || !year) return i.user_rating;
  const wy = watchedSeasonYears(v, i);
  const seasonsInY = wy.filter(([, y]) => y === year).map(([s]) => s);
  const ratings = seasonsInY
    .map((s) => v.ratingMap?.[String(s)])
    .filter((r): r is number => r != null);
  if (ratings.length === 0) return null;
  return ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
}

export function computeStats(
  items: StatsRawItem[],
  rewatches: RewatchStatItem[],
  year: number | null,
  /** tmdb_id → AniList cours. Omit and every title is read in its stored coordinates. */
  cours: Map<number, AnimeCoursRow> = new Map(),
  history: HistoryAnalytics = {records:[],ratings:[]},
): ComputedStats {
  // ONE lens per title, built once and shared by every helper below, so no two cards on this page
  // can end up reasoning in different coordinate spaces.
  const viewOf = makeViewOf(cours);
  history={...history,records:deduplicateFirstViewing(history.records)};
  const ledger: WatchContribution[] = items.flatMap(i => historicalContributions(i,viewOf(i),history,seasonContributions(viewOf(i),i)));
  {
    const represented=new Set(history.records.filter(r => r.kind==="REWATCH").map(r => r.id));
    for (const [index,r] of rewatches.entries()) {
      if (r.id && represented.has(r.id)) continue;
      // Stored watch dates are accepted calendar data; they do not establish scope or duration.
      ledger.push({id:r.id ?? `legacy-rewatch:${index}`,itemId:r.media_item_id,...legacyViewingDate(r.watched_on),
        episodes:null,minutes:null,rewatch:true,source:"LEGACY",scope:"Legacy scope unknown"});
    }
  }
  const recordById=new Map(history.records.map(r=>[r.id,r]));
  // Presentation follows actual period consumption, not the number of dated years.
  const presentation=(i:StatsRawItem) => {
    const v=viewOf(i);
    if (!year || i.type==="film") return {seasonLabel:null,seasonPoster:null};
    const rows=ledger.filter(c=>c.itemId===i.id && periodMatches(c,year));
    const seasons=[...new Set(rows.flatMap(c=>c.displaySeasons ?? []))].sort((a,b)=>a-b);
    // An unscoped legacy rewatch cannot prove a single season.
    if (!seasons.length || rows.some(c=>!c.displaySeasons?.length)) return {seasonLabel:null,seasonPoster:null};
    const scoped=rows.every(c=>c.source==="HISTORY" && !c.rewatch && c.episodes===rangeCount(recordById.get(c.id)?.ranges ?? []));
    const episodeLabel=scoped && seasons.length===1 ? periodEpisodeLabel(v,seasons[0],rows.map(c=>recordById.get(c.id)!)):null;
    const seasonLabel=seasons.length===1 ? `Season ${seasons[0]}${episodeLabel ? ` · ${episodeLabel}`:""}` : `${seasons.length} seasons`;
    const poster=seasons.length===1 ? v.seasons[seasons[0]-1]?.poster : null;
    return {seasonLabel,seasonPoster:poster ? poster.startsWith("http") ? poster : `https://image.tmdb.org/t/p/w500${poster}` : null};
  };
  const inPeriod=(i:StatsRawItem) => ledger.some(c => c.itemId===i.id && periodMatches(c,year));
  const ratingContextOf=(i:StatsRawItem) => {
    const fallback=effectiveRating(viewOf(i),i,year);
    if (!year || i.type==="film") return {score:year && recordsFor(i,history).some(r=>r.kind==="FIRST_WATCH") ? null:fallback,scopes:[]};
    const v=viewOf(i);
    const votes=watchedSeasonYears(v,i).filter(([,y]) => y===year).flatMap(([number]) => {
      const score=v.ratingMap?.[String(number)];
      return score==null ? [] : [{kind:v.overlaid ? "COUR" : "SEASON",number,score}];
    });
    return historicalRatingResult(i,history,year,fallback,votes);
  };
  const ratingOf=(i:StatsRawItem):number|null=>ratingContextOf(i).score;
  const frozenEntries=(type:string):HoursEntry[] => items.filter(i => i.type===type).flatMap(i => {
    const contributions=ledger.filter(c => !c.rewatch && c.itemId===i.id && periodMatches(c,year));
    if (!contributions.length) return [];
    const minutes=contributions.reduce((n,c) => n+(c.minutes ?? 0),0),episodes=contributions.reduce((n,c) => n+(c.episodes ?? 0),0);
    const known=contributions.every(c => c.minutes!=null && !c.durationUnknown);
    return [{item:i,episodes,minutes,runtime:known && episodes>0 ? minutes/episodes : null,source:contributions.every(c=>c.source==="HISTORY") ? "HISTORY" as const : contributions.every(c=>c.source==="LEGACY") ? "LEGACY" as const : "MIXED" as const,...presentation(i)}];
  }).sort((a,b) => b.minutes-a.minutes);


  // Completed titles (used for the available-year list below).

  // The titles that belong to the selected period — all-time = your library
  // (watched OR in progress), per-year = season-aware (episodes watched that
  // year). SINGLE source for counts, genres, ratings AND wrapped, so every card
  // in a year view talks about the exact same set of titles.
  const periodItems = items.filter(inPeriod);
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
      // "In progress" means you're BEHIND what's aired — actively watching. A show you've caught up
      // to and are now waiting on a new season for is `in_progress` in the DB (it isn't over), but
      // it is NOT something you're mid-watch on: it's `caught-up`, exactly as the Last Watched rail
      // re-buckets it. Counting those as "in progress" made the card claim 3 in progress when only
      // one (an airing show) truly was. Same `isAwaitingNextSeason` split as the rails.
      inProgress: of.filter((i) => i.in_progress && !isAwaitingNextSeason(i)).length,
      caughtUp:   of.filter((i) => i.in_progress && isAwaitingNextSeason(i)).length,
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
  const filmEntries=frozenEntries("film");
  const serieEntries=frozenEntries("serie");
  const animeEntries=frozenEntries("anime");

  const sumMinutes = (es: { minutes: number }[]) => es.reduce((s, e) => s + e.minutes, 0);
  const filmMin = sumMinutes(filmEntries);
  const serieMin = sumMinutes(serieEntries);
  const animeMin = sumMinutes(animeEntries);

  // Frozen rewatches share the ledger; unresolved legacy events never borrow today's scope.
  const itemById = new Map(items.map(i=>[i.id,i]));
  let rewatchCount = 0;
  const rewatchMin = { film: 0, serie: 0, anime: 0 };
  const rewatchEntries: RewatchEntry[] = [];
  for (const c of ledger.filter(c => c.rewatch && periodMatches(c,year))) {
    rewatchCount++;
    const item=itemById.get(c.itemId);
    if (!item) continue;
    rewatchEntries.push({item,watchedOn:formatHistoryDate(c),minutes:c.minutes,scope:c.scope,durationUnknown:c.durationUnknown});
    const type=item.type as keyof typeof rewatchMin;
    if (type in rewatchMin) rewatchMin[type]+=c.minutes ?? 0;
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
    .map(ratingOf)
    .filter((r): r is number => r != null);
  const avgRating = periodRatings.length > 0
    ? periodRatings.reduce((s, r) => s + r, 0) / periodRatings.length
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
    if (Number.isFinite(r) && r >= 1 && r <= 10) dist[r] = (dist[r] ?? 0) + 1;
  }
  // Keep exact scores (including annual averages); rounding9.5 to10 invents a higher maximum.
  const scores=Object.keys(dist).map(Number).sort((a,b)=>a-b);
  const ratingDistribution=[...new Set([...scores,...Array.from({length:10},(_,i)=>i+1)
    .filter(score=>scores.length && score>=scores[0] && score<=scores[scores.length-1])])]
    .sort((a,b)=>a-b).map(score=>({score,count:dist[score] ?? 0}));

  // Annual Top Picks require first-view consumption in that year. Rewatch-only
  // activity still contributes to counts/hours/calendar, but cannot qualify a pick.
  // All-time eligibility and the existing favorite/rating rules remain unchanged.
  const topPickIds=new Set(ledger.filter(c=>periodMatches(c,year) && (year==null || !c.rewatch)).map(c=>c.itemId));
  const topFavorites = items
    .map((item) => {
      const rating=ratingContextOf(item);
      return {item,rating:rating.score,...ratedScopePresentation(viewOf(item),rating.scopes)};
    })
    .filter((x) => topPickIds.has(x.item.id) && (x.item.favorite || (x.rating ?? 0) >= 8))
    .sort((a, b) => {
      // Rank by YOUR rating first — a 9.0 must beat a 7.5 even if the 7.5 is a
      // favorite. Favorite is only a tiebreaker between equal ratings.
      const byRating = (b.rating ?? 0) - (a.rating ?? 0);
      if (byRating !== 0) return byRating;
      if (a.item.favorite !== b.item.favorite) return a.item.favorite ? -1 : 1;
      return a.item.id.localeCompare(b.item.id);
    });

  const wrappedPosters = [...periodItems]
    .filter((i) => i.poster_url)
    .sort((a, b) => {
      if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
      return (ratingOf(b) ?? 0) - (ratingOf(a) ?? 0);
    })
    .slice(0, 3)
    // Use the season's own poster for the year when it resolves to a single season (e.g. MHA S8),
    // matching Top Picks — else fall back to the show poster. Already a full URL.
    .map((i) => ({ ...i, poster_url: presentation(i).seasonPoster ?? i.poster_url }));

  const availableYears=[...new Set(ledger.flatMap(c=>[c.year,c.calendarDate?.year].filter((y):y is number=>y!=null)))].sort((a,b)=>b-a);

  const yearlyStats=calendarStats(ledger,items,history,"YEAR",null);
  const monthlyStats=calendarStats(ledger,items,history,"MONTH",year);
  const dailyStats=calendarStats(ledger,items,history,"DAY",year);
  const activityRows=(rows:CalendarStats[])=>rows.map(r=>({label:r.label,count:r.events}));
  const months=activityRows(monthlyStats),years=activityRows(yearlyStats);
  const best=(rows:{label:string;count:number}[])=>[...rows].sort((a,b)=>b.count-a.count)[0] ?? null;
  return {availableYears,counts,statusCounts,rewatches:rewatchCount,hours,
    yearlyStats,monthlyStats,dailyStats,
    episodes:ledger.filter(c => periodMatches(c,year) && itemById.get(c.itemId)?.type!=="film").reduce((n,c) => n+(c.episodes ?? 0),0),
    unknownDurationEvents:ledger.filter(c => periodMatches(c,year) && (c.minutes==null || c.durationUnknown)).length,
    unknownScopeEvents:ledger.filter(c => periodMatches(c,year) && c.episodes==null).length,
    breakdown:{film:filmEntries,serie:serieEntries,anime:animeEntries,rewatches:rewatchEntries},avgRating,ratedCount:periodRatings.length,
    topGenres,ratingDistribution,topFavorites,wrappedPosters,activity:year ? months : years,dailyActivity:activityRows(dailyStats),
    streaks:{bestMonth:best(months),activeMonthsCount:months.length,bestYear:best(years)}};
}
