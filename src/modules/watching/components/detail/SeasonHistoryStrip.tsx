"use client";

import { useRef } from "react";
import { Tv, Lock, Clock, EyeOff } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/shared/components/ui/select";
import { CarouselNav } from "@/shared/components/ui/carousel-nav";
import { SectionHeader } from "@/shared/components/ui/section-header";
import { Badge } from "@/shared/components/ui/badge";
import { ScoreMark } from "@/modules/watching/components/shared/Marks";
import { isSeasonComplete, isSeasonDatable, isSeasonLive } from "@/modules/watching/lib/series-state";

interface Props {
  seasonEpisodes: number[];
  /** Episodes ACTUALLY AIRED per season. A season with 0 aired is not out, whatever TMDB announces. */
  seasonAired: number[] | null | undefined;
  currentEpisode: number;
  seasonPosters: (string | null)[] | null | undefined;
  seasonAirDates: (string | null)[] | null | undefined;
  /** Last aired episode's date per season — null while a season is still coming out. */
  seasonEndDates: (string | null)[] | null | undefined;
  seasonYears: Record<string, number> | null | undefined;
  seasonRatings: Record<string, number> | null | undefined;
  showPoster: string | null;        // fallback when a season has no poster
  releaseYear: number | null;
  currentSeason: number;            // live, from Currently Watching
  inProgress: boolean;              // ACTIVELY watching now → drives the "Now" badge
  incomplete: boolean;              // not fully watched (in progress / paused / dropped) → locks unreached seasons
  /** A title you have not started: no claim to show on any card — posters, numbers, dates only. */
  unwatched?: boolean;
  onYearChange: (next: Record<string, number>) => void;
  /** A season card is a DOOR — every one opens the season panel. */
  onOpenSeason: (season: number) => void;
}

const TMDB_IMG = "https://image.tmdb.org/t/p/w300";
const TEAL = "var(--color-accent-watching-vivid)";

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

/**
 * THE SEASONS — the object, with your history laid over it when there is one.
 *
 * This was "Watch History": a row of season posters whose popover set a year and a rating, shown
 * only on a title you had engaged with. It is now the strip of SEASONS: every card opens the
 * season panel (where the year, the rating, "watched through" and the episodes all live), and a
 * title you haven't started gets the strip too — posters and dates, no claims. What stays on the
 * card is what you can read at a glance: the year you watched it, your score, "Now", what's ahead
 * of you, what hasn't aired. "Set all year" stays up here because it is the one edit that spans
 * seasons.
 */
export function SeasonHistoryStrip({
  seasonEpisodes, seasonAired, seasonPosters, seasonAirDates, seasonEndDates, seasonYears, seasonRatings,
  showPoster, releaseYear, currentSeason, currentEpisode, inProgress, incomplete, unwatched = false,
  onYearChange, onOpenSeason,
}: Props) {
  const airedIn = (idx: number) => (seasonAired ?? [])[idx] ?? 0;

  // A season may carry a WATCH YEAR only once it has FULLY AIRED and you have watched it to the
  // end. That rule lives in series-state.ts and nowhere else.
  const facts = {
    season_episodes: seasonEpisodes,
    season_aired: seasonAired,
    current_season: currentSeason,
    current_episode: currentEpisode,
    watched: !incomplete,
  };
  const datable = (idx: number) => !unwatched && isSeasonDatable(facts, idx + 1);

  const now = new Date();
  const currentYear = now.getFullYear();
  const nowMs = now.getTime();
  const scrollRef = useRef<HTMLDivElement>(null);

  if (seasonEpisodes.length < 1) return null;

  // A season nothing has aired from is not watchable — whatever TMDB has announced about it.
  // (The air-date check is kept as a fallback for rows the sync hasn't reached yet.)
  const comingSoonAt = (idx: number) => {
    if (seasonAired) return airedIn(idx) === 0;
    const d = seasonAirDates?.[idx];
    return !!d && new Date(d).getTime() > nowMs;
  };
  // Ahead of you = a season after the one you stopped in, on a show you haven't finished.
  const aheadAt = (idx: number) => !unwatched && incomplete && idx + 1 > currentSeason;
  /**
   * The earliest year you could have WATCHED this season — the year it ENDED, not the year it
   * started. `season_end_dates` is the sync's answer; the start date is a loose floor for rows the
   * sync hasn't reached yet — never a wrong lock.
   */
  const watchableFrom = (idx: number) => {
    const d = seasonEndDates?.[idx] ?? seasonAirDates?.[idx];
    return (d ? new Date(d).getFullYear() : null) ?? releaseYear ?? 1900;
  };

  // "Set all" applies a year to every season you may TRUTHFULLY date — not to every season that
  // isn't visibly locked. The season you're in the middle of isn't locked (you're watching it),
  // and one tap used to date it.
  const datableIdx = seasonEpisodes.map((_, idx) => idx).filter(datable);

  // Range floors at the LATEST of those seasons' air years — you cannot have watched them all
  // before the last one existed.
  const setAllYears = (() => {
    const floor = datableIdx.reduce((f, idx) => Math.max(f, watchableFrom(idx)), releaseYear ?? 1900);
    const out: number[] = [];
    for (let y = currentYear; y >= Math.min(floor, currentYear); y--) out.push(y);
    return out;
  })();

  const setAll = (year: number) => {
    const next = { ...(seasonYears ?? {}) };
    datableIdx.forEach((idx) => { next[String(idx + 1)] = year; });
    onYearChange(next);
  };

  const scroll = (dir: number) => scrollRef.current?.scrollBy({ left: dir * 320, behavior: "smooth" });

  // A scrolling rail — no panel, same rule as Episodes / Cast / More Like This.
  return (
    <section>
      <SectionHeader
        title="Seasons"
        actions={
          <>
            {/* An action-select, not a filter: it has no persisted value, it applies a year to
                every DATABLE season at once. With nothing to date it isn't a disabled control, it's
                simply absent: there is no action here. */}
            {datableIdx.length > 0 && (
              <Select onValueChange={(v) => setAll(Number(v))}>
                <SelectTrigger variant="legacy" className="h-8 w-auto gap-2 border-border-subtle bg-surface-2 px-3.5 text-xs text-text-secondary transition-colors hover:bg-surface-3 hover:text-text-primary focus:ring-0">
                  <SelectValue placeholder="Set all year" />
                </SelectTrigger>
                <SelectContent variant="legacy" className="border-border-strong bg-surface-3">
                  {setAllYears.map((y) => (
                    <SelectItem key={y} value={String(y)} className="text-xs focus:bg-surface-2 focus:text-text-primary">All in {y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {seasonEpisodes.length > 6 && (
              <CarouselNav size="md" onPrev={() => scroll(-1)} onNext={() => scroll(1)} />
            )}
          </>
        }
      />

      {/* Breaks out of the column padding like More Like This does, so a card can scroll under
          the screen's right edge instead of stopping short of it. */}
      <div
        ref={scrollRef}
        className="-mx-4 flex gap-3 overflow-x-auto scroll-px-4 px-4 py-1.5 scrollbar-hide sm:-mx-1.5 sm:px-1.5 sm:scroll-px-1.5"
      >
        {seasonEpisodes.map((_, idx) => {
          const s = idx + 1;
          const comingSoon = comingSoonAt(idx);
          const ahead = aheadAt(idx);
          const editable = !comingSoon && datable(idx);
          // "Now" = the season you are INSIDE. The rule is `isSeasonLive` and lives in
          // series-state.ts with the rest of them.
          const current = !unwatched && inProgress && isSeasonLive(facts, s);
          // A stamp on a season you haven't reached is a claim you're no longer making. The data
          // stays (it comes back when you advance again) — we just stop reading it.
          const reached = !unwatched && (!incomplete || s <= currentSeason);
          const year = reached ? seasonYears?.[String(s)] : undefined;
          const rating = reached ? seasonRatings?.[String(s)] : undefined;
          const posterPath = seasonPosters?.[idx] ?? null;
          // AniList cours store an ABSOLUTE url; TMDB seasons store a path fragment. Detect which.
          const poster = posterPath
            ? (posterPath.startsWith("http") ? posterPath : `${TMDB_IMG}${posterPath}`)
            : (showPoster ?? null);
          const airDate = seasonAirDates?.[idx] ?? null;

          return (
            <button
              key={s}
              type="button"
              onClick={() => onOpenSeason(s)}
              aria-label={`Season ${s}`}
              className="group w-(--rail-peek) shrink-0 cursor-pointer text-left sm:w-(--poster-lg)"
            >
              <div className="relative aspect-2/3 w-full overflow-hidden rounded-tile border border-border-subtle bg-surface-1 transition-transform duration-300 ease-out group-hover:z-10 group-hover:scale-[1.04]">
                {poster ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={poster} alt="" loading="lazy" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-surface-2">
                    <Tv size={20} className="text-text-tertiary" />
                  </div>
                )}

                {/* Top-left = WHEN. Shown under exactly the rule that lets you edit it — a season
                    that can't be dated shows no year, even if it carries one it can no longer
                    claim. The data stays; we just stop reading it. */}
                {editable && (
                  <Badge
                    variant="flag"
                    size="sm"
                    color={year ? "#ffffff" : "rgba(255,255,255,0.7)"}
                    className="absolute left-2 top-2 tabular-nums"
                  >
                    {year ?? "Year"}
                  </Badge>
                )}

                {/* Top-right = the live season of a show you're on. */}
                {current && !comingSoon && (
                  <Badge variant="flag" size="sm" dot color={TEAL} className="absolute right-2 top-2">
                    Now
                  </Badge>
                )}

                {/* Bottom mask — the season, and YOUR score for it. */}
                <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/85 to-transparent p-2 pt-7">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">S{s}</span>
                    {!ahead && rating != null && (
                      <ScoreMark value={rating} source="mine" onArtwork />
                    )}
                  </div>
                </div>

                {comingSoon ? (
                  /* Mask — not aired yet */
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/70 px-2 text-center">
                    <Clock size={14} className="text-white/75" />
                    <span className="text-micro font-semibold text-white/85">Coming soon</span>
                    {airDate && <span className="text-[9px] text-white/50">{fmtDate(airDate)}</span>}
                  </div>
                ) : ahead ? (
                  /* Aired, ahead of where you stand — NOT seen yet. An eye-off states that plainly
                     (a padlock said "forbidden"); a season still airing that you haven't reached
                     is the one thing you can't claim yet, and it keeps the lock. */
                  <div className="absolute inset-0 flex items-center justify-center bg-black/45 transition-colors group-hover:bg-black/25">
                    <div className="on-artwork flex h-7 w-7 items-center justify-center rounded-full">
                      {isSeasonComplete(facts, s)
                        ? <EyeOff size={13} className="text-white" />
                        : <Lock size={13} className="text-white/85" />}
                    </div>
                  </div>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
