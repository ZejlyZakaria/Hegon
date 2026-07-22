"use client";

import { useRef } from "react";
import { Check, Pencil, Tv, Lock, Clock, EyeOff } from "lucide-react";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/shared/components/ui/popover";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/shared/components/ui/select";
import { CarouselNav } from "@/shared/components/ui/carousel-nav";
import { SectionHeader } from "@/shared/components/ui/section-header";
import { Badge } from "@/shared/components/ui/badge";
import { Hint } from "@/shared/components/ui/tooltip";
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
  onYearChange: (next: Record<string, number>) => void;
  onRatingChange: (next: Record<string, number>) => void;
  /** "I watched through this season" — moves where you stand. The page re-derives the status. */
  onSetPosition: (season: number, episode: number) => void;
}

const TMDB_IMG = "https://image.tmdb.org/t/p/w300";
const TEAL = "var(--color-accent-watching-vivid)";

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

// Visual per-season watch history — a row of season poster cards (sized to match
// "More Like This" so the two rows align), each showing the year + rating you gave
// it. Click a card → popover to set year & rating. Not-yet-started seasons of an
// in-progress show are locked; seasons that haven't aired yet show "Coming soon".
export function SeasonHistoryStrip({
  seasonEpisodes, seasonAired, seasonPosters, seasonAirDates, seasonEndDates, seasonYears, seasonRatings,
  showPoster, releaseYear, currentSeason, currentEpisode, inProgress, incomplete, onYearChange, onRatingChange,
  onSetPosition,
}: Props) {
  const airedIn = (idx: number) => (seasonAired ?? [])[idx] ?? 0;

  // A season may carry a WATCH YEAR only once it has FULLY AIRED and you have watched it to the
  // end. That rule now lives in series-state.ts and nowhere else — this component used to own a
  // private version of it ("is it behind my position"), which called season 4 of FROM undatable
  // though you'd watched every episode of it, while "Set all year" used no rule at all and would
  // happily stamp a year on a season that is still coming out.
  const facts = {
    season_episodes: seasonEpisodes,
    season_aired: seasonAired,
    current_season: currentSeason,
    current_episode: currentEpisode,
    watched: !incomplete,
  };
  // Datable = fully aired AND fully watched — computed from the (cour, under the overlay) facts, so
  // it works identically in either coordinate space. The year/rating the popover writes come from
  // whichever maps the caller passes: season_years (TMDB seasons) or cour_years (AniList cours).
  const datable = (idx: number) => isSeasonDatable(facts, idx + 1);

  /**
   * "I watched through this season." Offered on any FULLY AIRED season that isn't already exactly
   * where you stand — in BOTH directions, because they're the same gesture:
   *   · forward  — you'd seen three seasons of Seven Deadly Sins, and the app only knew of one.
   *   · backward — you dropped it after season 2, not season 3.
   * A season still coming out is never offered: you cannot have "watched through" it. Standing at
   * the end of what's out is being CAUGHT UP, and the StatusCard owns that word.
   */
  const fullEps = (idx: number) => seasonEpisodes[idx] ?? 0;
  const standingAt = (idx: number) => currentSeason === idx + 1 && currentEpisode >= fullEps(idx);
  const jumpable = (idx: number) =>
    !comingSoonAt(idx) && isSeasonComplete(facts, idx + 1) && !standingAt(idx);

  const now = new Date();
  const currentYear = now.getFullYear();
  const nowMs = now.getTime();
  const scrollRef = useRef<HTMLDivElement>(null);

  if (seasonEpisodes.length <= 1) return null;

  // A season nothing has aired from is not watchable — whatever TMDB has announced about it.
  // (The air-date check is kept as a fallback for rows the sync hasn't reached yet.)
  const comingSoonAt = (idx: number) => {
    if (seasonAired) return airedIn(idx) === 0;
    const d = seasonAirDates?.[idx];
    return !!d && new Date(d).getTime() > nowMs;
  };
  // Locked = unreleased OR (not-fully-watched show, season after where you stopped).
  const lockedAt = (idx: number) => comingSoonAt(idx) || (incomplete && idx + 1 > currentSeason);
  /**
   * The earliest year you could have WATCHED this season — which is the year it ENDED, not the
   * year it started. A season that premiered in December 2026 and closed in February 2027 could
   * not have been watched through in 2026, yet the picker offered it, because the only date this
   * component had was the start. `season_end_dates` is the sync's answer to that.
   * (Fallback to the start date for rows the sync hasn't reached yet — a loose floor, never a
   * wrong lock.)
   */
  const watchableFrom = (idx: number) => {
    const d = seasonEndDates?.[idx] ?? seasonAirDates?.[idx];
    return (d ? new Date(d).getFullYear() : null) ?? releaseYear ?? 1900;
  };

  // Year options for a given season — never before it finished airing, never after now.
  const yearsFor = (idx: number) => {
    const out: number[] = [];
    for (let y = currentYear; y >= Math.min(watchableFrom(idx), currentYear); y--) out.push(y);
    return out;
  };

  // "Set all" applies a year to every season you may TRUTHFULLY date — not to every season that
  // isn't visibly locked. Those are different sets, and the gap between them was the bug: the
  // season you're in the middle of isn't locked (you're watching it), so one tap dated a season
  // you haven't finished, and House of the Dragon read "2026" for a season with four of its eight
  // episodes out.
  const datableIdx = seasonEpisodes.map((_, idx) => idx).filter(datable);

  // Range floors at the LATEST of those seasons' air years — you cannot have watched them all
  // before the last one existed.
  const setAllYears = (() => {
    const floor = datableIdx.reduce((f, idx) => Math.max(f, watchableFrom(idx)), releaseYear ?? 1900);
    const out: number[] = [];
    for (let y = currentYear; y >= Math.min(floor, currentYear); y--) out.push(y);
    return out;
  })();

  const setYear = (season: number, year: number) =>
    onYearChange({ ...(seasonYears ?? {}), [String(season)]: year });

  const setAll = (year: number) => {
    const next = { ...(seasonYears ?? {}) };
    datableIdx.forEach((idx) => { next[String(idx + 1)] = year; });
    onYearChange(next);
  };

  const setRating = (season: number, value: string) => {
    const next = { ...(seasonRatings ?? {}) };
    if (value === "none") delete next[String(season)];
    else next[String(season)] = Number(value);
    onRatingChange(next);
  };

  const scroll = (dir: number) => scrollRef.current?.scrollBy({ left: dir * 320, behavior: "smooth" });

  // A scrolling rail — no panel, same rule as Episodes / Cast / More Like This.
  return (
    <section>
      <SectionHeader
        title="Watch History"
        actions={
          <>
            {/* An action-select, not a filter: it has no persisted value, it applies a year to
                every DATABLE season at once. With nothing to date — you've only started season 1,
                say — it isn't a disabled control, it's simply absent: there is no action here. */}
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
          the screen's right edge instead of stopping short of it. Both rails now bleed the
          same way — THAT was the mismatch, not the tile size. */}
      <div
        ref={scrollRef}
        className="-mx-4 flex gap-3 overflow-x-auto scroll-px-4 px-4 py-1.5 scrollbar-hide sm:-mx-1.5 sm:px-1.5 sm:scroll-px-1.5"
      >
        {seasonEpisodes.map((eps, idx) => {
          const s = idx + 1;
          const comingSoon = comingSoonAt(idx);
          const locked = lockedAt(idx);
          // The popover sets a YEAR and a RATING — both are verdicts on a season you have
          // FINISHED. Offering them on the season you're halfway through was the same hole as
          // "Set all year", one card at a time. The card stays visible and readable; only the
          // claim is refused, and it opens by itself the moment you reach the end.
          const editable = !locked && datable(idx);
          const canJump = jumpable(idx);
          const interactive = editable || canJump;
          /**
           * THE SEASON YOU ARE IN IS NOT UNSEEN.
           *
           * The eye-off says "this aired ahead of you — you haven't watched it". True of a season
           * you have not started. False, and visibly so, of the one you are IN THE MIDDLE OF: it
           * is fully aired (so it can be claimed) and not fully watched (so it can't be dated),
           * and those two facts together were the whole mask condition. So the season you were
           * actively watching wore "not seen" — right next to the "Now" badge saying you were
           * watching it — until you finished it and it flipped straight to done.
           *
           * Three states, not two: ahead of you (unseen), under you (in progress), behind you
           * (seen). Only the first is a claim to make. The CLICK stays available on all of them —
           * "watched through S2" is still a legitimate thing to say about the season you are in.
           */
          const unseenAhead = canJump && !editable && s !== currentSeason;
          // "Now" = the season you are INSIDE. The rule is `isSeasonLive` and lives in
          // series-state.ts with the rest of them — this component owning a private version of it
          // is the exact shape of the last three bugs here.
          const current = inProgress && isSeasonLive(facts, s);
          // A stamp on a season you haven't reached is a claim you're no longer making. The data
          // stays (it comes back when you advance again) — we just stop reading it.
          const reached = !incomplete || s <= currentSeason;
          const year = reached ? seasonYears?.[String(s)] : undefined;
          const rating = reached ? seasonRatings?.[String(s)] : undefined;
          const posterPath = seasonPosters?.[idx] ?? null;
          // AniList cours store an ABSOLUTE url; TMDB seasons store a path fragment. Detect which.
          const poster = posterPath
            ? (posterPath.startsWith("http") ? posterPath : `${TMDB_IMG}${posterPath}`)
            : (showPoster ?? null);
          const airDate = seasonAirDates?.[idx] ?? null;

          const cardInner = (
            <div className={`relative aspect-2/3 w-full overflow-hidden rounded-tile border border-border-subtle bg-surface-1 transition-transform duration-300 ease-out ${
              editable ? "group-hover:z-10 group-hover:scale-[1.04]" : ""
            }`}>
              {poster ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={poster} alt={`Season ${s}`} loading="lazy" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-surface-2">
                  <Tv size={20} className="text-text-tertiary" />
                </div>
              )}

              {/**
               * Top-left = WHEN.
               *
               * The "Year" placeholder is a CALL TO ACTION ("click to date this season") — and we
               * refuse that action on a season that isn't fully aired and watched. Offering it
               * anyway was the app inviting you to do something it would then decline. On a season
               * still coming out, "Now" says everything that's true.
               *
               * ⚠️ SHOWN UNDER EXACTLY THE RULE THAT LETS YOU EDIT IT — `editable`, not a looser
               * variant of it. This used to add `|| year != null`, so a season carrying a year it
               * could no longer claim (you stepped back into it, or it grew another episode) kept
               * displaying that year while the popover refused to change or clear it. A number you
               * cannot touch is the app asserting something on your behalf and then locking the
               * door.
               *
               * The year is NOT deleted — same philosophy as `reached` above: the data stays and
               * comes back the moment the season is datable again. We simply stop reading it while
               * the claim isn't yours to make.
               */}
              {editable && (
                <Badge
                  variant="flag"
                  size="sm"
                  color={year ? "#ffffff" : "rgba(255,255,255,0.7)"}
                  className="absolute left-1.5 top-1.5 tabular-nums"
                >
                  {year ?? "Year"}
                </Badge>
              )}

              {/* Top-right = the live season of a show you're on. This badge (teal dot + white
                  word) was the only glass chip in the app that ever looked right — it's now
                  the primitive's own behaviour, so the hand-rolled dot goes. */}
              {current && !comingSoon && (
                <Badge variant="flag" size="sm" dot color={TEAL} className="absolute right-1.5 top-1.5">
                  Now
                </Badge>
              )}

              {/* Bottom mask — the season, and YOUR score for it. The star was amber: the
                  world's colour on a number the world never gave. It's yours → teal. */}
              <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/85 to-transparent p-2 pt-7">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">S{s}</span>
                  {!locked && rating != null && (
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
              ) : unseenAhead ? (
                /* Aired, ahead of where you stand — NOT seen yet, but you may claim it. An eye-off
                   states that plainly; a padlock said "forbidden" and a check would say "done". */
                <div className="absolute inset-0 flex items-center justify-center bg-black/45 transition-colors group-hover:bg-black/25">
                  <div className="on-artwork flex h-7 w-7 items-center justify-center rounded-full">
                    <EyeOff size={13} className="text-white" />
                  </div>
                </div>
              ) : locked ? (
                /* Mask — genuinely unreachable (a later season still airing, so not yet claimable) */
                <div className="absolute inset-0 flex items-center justify-center bg-black/65">
                  <Lock size={15} className="text-white/55" />
                </div>
              ) : editable ? (
                /* Hover edit affordance */
                <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/25 group-hover:opacity-100">
                  <div className="on-artwork flex h-7 w-7 items-center justify-center rounded-full">
                    <Pencil size={12} className="text-white" />
                  </div>
                </div>
              ) : null}
            </div>
          );

          // Nothing to say about this season → not a button. That's the season you're in the
          // middle of (it carries "Now", which already says everything true) and the ones that
          // haven't aired.
          if (!interactive) {
            return (
              <Hint key={s} label={comingSoon ? "Not aired yet" : "Finish this season to date and rate it"}>
                <div
                  className={`w-(--rail-peek) shrink-0 sm:w-(--poster-lg) ${comingSoon ? "cursor-not-allowed" : "cursor-default"}`}
                >
                  {cardInner}
                </div>
              </Hint>
            );
          }

          return (
            <Popover key={s}>
              <PopoverTrigger asChild>
                <button type="button" className="group w-(--rail-peek) shrink-0 cursor-pointer text-left sm:w-(--poster-lg)">
                  {cardInner}
                </button>
              </PopoverTrigger>

              <PopoverContent align="start" className="w-52 bg-surface-3 border-border-strong p-3">
                <div className="mb-2">
                  <p className="text-xs font-semibold text-text-primary">Season {s}</p>
                  {airDate && <p className="text-micro text-text-tertiary">Aired {fmtDate(airDate)} · {eps} ep{eps > 1 ? "s" : ""}</p>}
                </div>

                {editable && (
                  <>
                <label className="mb-1 block text-micro text-text-tertiary">Year watched</label>
                <Select value={year ? String(year) : undefined} onValueChange={(v) => setYear(s, Number(v))}>
                  <SelectTrigger variant="legacy" className="h-8 w-full border-border-subtle bg-surface-1 text-xs text-text-primary focus:ring-0">
                    <SelectValue placeholder="Pick a year" />
                  </SelectTrigger>
                  <SelectContent variant="legacy" className="bg-surface-3 border-border-strong">
                    {yearsFor(idx).map((yr) => (
                      <SelectItem key={yr} value={String(yr)} className="text-xs focus:bg-surface-2 focus:text-text-primary">{yr}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <label className="mb-1 mt-3 block text-micro text-text-tertiary">Rating</label>
                <Select value={rating ? String(rating) : undefined} onValueChange={(v) => setRating(s, v)}>
                  <SelectTrigger variant="legacy" className="h-8 w-full border-border-subtle bg-surface-1 text-xs text-accent-watching-vivid focus:ring-0">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent variant="legacy" className="bg-surface-3 border-border-strong">
                    <SelectItem value="none" className="text-xs focus:bg-surface-2 focus:text-text-primary">—</SelectItem>
                    {[10, 9.5, 9, 8.5, 8, 7.5, 7, 6.5, 6, 5.5, 5].map((n) => (
                      <SelectItem key={n} value={String(n)} className="text-xs focus:bg-surface-2 focus:text-text-primary">{n}/10</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                  </>
                )}

                {/* WHERE YOU STAND — the edit the page never had. It reads as a plain sentence
                    because that's what it is: a claim about how far you got. The status follows
                    from it (a show you'd called "watched" stops being watched when you say you
                    stopped at season 3), and the years are deliberately left alone: claiming a
                    season today doesn't mean you watched it today. */}
                {canJump && (
                  <>
                    {editable && <div className="my-3 h-px bg-border-default" />}
                    <button
                      type="button"
                      onClick={() => onSetPosition(s, eps)}
                      className="flex w-full items-center justify-center gap-1.5 rounded-control bg-surface-2 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-1 hover:text-text-primary"
                    >
                      <Check size={12} />
                      Watched through S{s}
                    </button>
                    {!editable && (
                      <p className="mt-1.5 text-center text-micro text-text-tertiary">
                        Mark it watched to rate this season.
                      </p>
                    )}
                  </>
                )}
              </PopoverContent>
            </Popover>
          );
        })}
      </div>
    </section>
  );
}
