import { episodeCountsForTime } from "./episode-counts";
import { flatEpisode, flatToCour, courToFlat, tmdbFromFlat } from "./anime-overlay";
import type { StatsRawItem } from "../service";
import type { MediaView } from "./media-view";

/** An accepted estimate, not a confirmed viewing assertion or provider catalogue. */
export interface LegacyConsumption {
  version:1; captured_at:string; counts:number[]; runtime:number|null;
  fallback_year:number|null; completed:boolean; storage_sizes?:number[]; calendar_date?:string|null;
}
export const legacyRuntime=(item:StatsRawItem):number|null =>
  item.legacy_consumption ? item.legacy_consumption.runtime : item.runtime;

/** Preserve the storage offsets used by legacy coverage when provider season lengths change. */
export function legacyCoordinates(item:StatsRawItem,view:MediaView) {
  const sizes=item.legacy_consumption?.storage_sizes;
  if(!sizes || !view.overlaid || !view.cours) return view;
  const cours=view.cours;
  return {
    fromStorage:(season:number,episode:number)=>flatToCour(flatEpisode(sizes,season,episode),cours),
    toStorage:(season:number,episode:number)=>tmdbFromFlat(sizes,courToFlat(season,episode,cours)),
  };
}

/** Frozen STORAGE coverage expressed through the current display lens. */
export function legacyDisplayCounts(item:StatsRawItem,view:MediaView):number[]|null {
  if(!item.legacy_consumption) return null;
  const coordinates=legacyCoordinates(item,view);
  const counts:number[]=[];
  item.legacy_consumption.counts.forEach((count,index)=>{
    for(let ep=1;ep<=count;ep++) {
      const position=coordinates.fromStorage(index+1,ep);
      counts[position.season-1]=(counts[position.season-1] ?? 0)+1;
    }
  });
  return Array.from({length:Math.max(view.seasons.length,counts.length)},(_,i)=>counts[i] ?? 0);
}

// Fallback year, used ONLY when a season carries no explicit stamp: finish date (watched_at) when
// completed, last-progress (updated_at) otherwise. This is the loose last resort — the honest year
// of a season/cour lives in `season_years`/`cour_years`, edited in ONE place (Watch History for a
// multi-season title, the StatusCard year picker for a single one). A parallel `caught_up_at` path
// was tried here and reverted: it made Stats read a second source for a fact that must have one.
function fallbackYearOf(i: StatsRawItem): number | null {
  if(i.legacy_consumption) return i.legacy_consumption.fallback_year;
  const d = i.watched || i.resume_required ? i.watched_at : i.updated_at;
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
export function seasonContributions(v: MediaView, i: StatsRawItem): { episodes: number; year: number | null }[] {
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
