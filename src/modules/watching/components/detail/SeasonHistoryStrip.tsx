"use client";

import { useRef } from "react";
import { Star, Pencil, Tv, Lock, Clock, ChevronLeft, ChevronRight } from "lucide-react";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/shared/components/ui/popover";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/shared/components/ui/select";

interface Props {
  seasonEpisodes: number[];
  seasonPosters: (string | null)[] | null | undefined;
  seasonAirDates: (string | null)[] | null | undefined;
  seasonYears: Record<string, number> | null | undefined;
  seasonRatings: Record<string, number> | null | undefined;
  showPoster: string | null;        // fallback when a season has no poster
  releaseYear: number | null;
  currentSeason: number;            // live, from Currently Watching
  inProgress: boolean;
  onYearChange: (next: Record<string, number>) => void;
  onRatingChange: (next: Record<string, number>) => void;
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
  seasonEpisodes, seasonPosters, seasonAirDates, seasonYears, seasonRatings,
  showPoster, releaseYear, currentSeason, inProgress, onYearChange, onRatingChange,
}: Props) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const nowMs = now.getTime();
  const scrollRef = useRef<HTMLDivElement>(null);

  if (seasonEpisodes.length <= 1) return null;

  // A season that hasn't aired yet (air_date in the future) → not watchable.
  const comingSoonAt = (idx: number) => {
    const d = seasonAirDates?.[idx];
    return !!d && new Date(d).getTime() > nowMs;
  };
  // Locked = unreleased OR (in-progress show, season after the one you're watching).
  const lockedAt = (idx: number) => comingSoonAt(idx) || (inProgress && idx + 1 > currentSeason);
  const airYearOf = (idx: number) => {
    const d = seasonAirDates?.[idx];
    return (d ? new Date(d).getFullYear() : null) ?? releaseYear ?? 1900;
  };

  // Year options for a given season — never before it aired, never after now.
  const yearsFor = (idx: number) => {
    const out: number[] = [];
    for (let y = currentYear; y >= Math.min(airYearOf(idx), currentYear); y--) out.push(y);
    return out;
  };

  // "Set all" range — only years on/after the latest editable season aired.
  const setAllYears = (() => {
    let floor = releaseYear ?? 1900;
    seasonEpisodes.forEach((_, idx) => {
      if (lockedAt(idx)) return;
      floor = Math.max(floor, airYearOf(idx));
    });
    const out: number[] = [];
    for (let y = currentYear; y >= Math.min(floor, currentYear); y--) out.push(y);
    return out;
  })();

  const setYear = (season: number, year: number) =>
    onYearChange({ ...(seasonYears ?? {}), [String(season)]: year });

  const setAll = (year: number) => {
    const next = { ...(seasonYears ?? {}) };
    seasonEpisodes.forEach((_, idx) => {
      if (!lockedAt(idx)) next[String(idx + 1)] = year;
    });
    onYearChange(next);
  };

  const setRating = (season: number, value: string) => {
    const next = { ...(seasonRatings ?? {}) };
    if (value === "none") delete next[String(season)];
    else next[String(season)] = Number(value);
    onRatingChange(next);
  };

  const scroll = (dir: number) => scrollRef.current?.scrollBy({ left: dir * 320, behavior: "smooth" });

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-title text-text-primary">Watch History</h2>
        <div className="flex items-center gap-1.5">
          <Select onValueChange={(v) => setAll(Number(v))}>
            <SelectTrigger className="h-6 w-auto gap-1 border-border-subtle bg-surface-2 px-2 text-[10px] text-text-tertiary focus:ring-0">
              <SelectValue placeholder="Set all year" />
            </SelectTrigger>
            <SelectContent className="bg-surface-3 border-border-strong">
              {setAllYears.map((y) => (
                <SelectItem key={y} value={String(y)} className="text-xs focus:bg-surface-2 focus:text-text-primary">All in {y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {seasonEpisodes.length > 6 && (
            <>
              <button type="button" onClick={() => scroll(-1)} className="flex h-6 w-6 items-center justify-center rounded-md border border-border-subtle bg-surface-2 text-text-tertiary transition-colors hover:text-text-primary">
                <ChevronLeft size={13} />
              </button>
              <button type="button" onClick={() => scroll(1)} className="flex h-6 w-6 items-center justify-center rounded-md border border-border-subtle bg-surface-2 text-text-tertiary transition-colors hover:text-text-primary">
                <ChevronRight size={13} />
              </button>
            </>
          )}
        </div>
      </div>

      <div ref={scrollRef} className="flex gap-3 overflow-x-auto scrollbar-hide py-1.5">
        {seasonEpisodes.map((eps, idx) => {
          const s = idx + 1;
          const comingSoon = comingSoonAt(idx);
          const locked = lockedAt(idx);
          const current = inProgress && s === currentSeason;
          const year = seasonYears?.[String(s)];
          const rating = seasonRatings?.[String(s)];
          const posterPath = seasonPosters?.[idx] ?? null;
          const poster = posterPath ? `${TMDB_IMG}${posterPath}` : (showPoster ?? null);
          const airDate = seasonAirDates?.[idx] ?? null;

          const cardInner = (
            <div className={`relative aspect-2/3 w-36 overflow-hidden rounded-tile border border-border-subtle bg-surface-1 transition-transform duration-300 ease-out ${
              locked ? "" : "group-hover:z-10 group-hover:scale-[1.04]"
            }`}>
              {poster ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={poster} alt={`Season ${s}`} loading="lazy" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-surface-2">
                  <Tv size={20} className="text-text-tertiary" />
                </div>
              )}

              {/* Year pill — top-left */}
              {!locked && (
                <div className={`absolute left-1.5 top-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-white/15 backdrop-blur-md ${
                  year ? "bg-black/65 text-white" : "bg-black/45 text-white/70"
                }`}>
                  {year ?? "Year"}
                </div>
              )}

              {/* "Now" badge — current season of an in-progress show (top-right) */}
              {current && !comingSoon && (
                <div className="absolute right-1.5 top-1.5 flex items-center gap-1 rounded-full bg-black/55 px-1.5 py-0.5 ring-1 ring-white/15 backdrop-blur-md">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: TEAL, boxShadow: `0 0 6px ${TEAL}` }} />
                  <span className="text-[9px] font-semibold text-white">Now</span>
                </div>
              )}

              {/* Bottom gradient — season + rating */}
              <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/85 to-transparent p-2 pt-7">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">S{s}</span>
                  {!locked && rating != null && (
                    <span className="flex items-center gap-0.5 text-[11px] font-semibold text-amber-300">
                      <Star size={10} className="fill-amber-300 text-amber-300" />{rating}
                    </span>
                  )}
                </div>
              </div>

              {comingSoon ? (
                /* Mask — not aired yet */
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/70 px-2 text-center">
                  <Clock size={14} className="text-white/75" />
                  <span className="text-[10px] font-semibold text-white/85">Coming soon</span>
                  {airDate && <span className="text-[9px] text-white/50">{fmtDate(airDate)}</span>}
                </div>
              ) : locked ? (
                /* Mask — released but not started yet */
                <div className="absolute inset-0 flex items-center justify-center bg-black/65">
                  <Lock size={15} className="text-white/55" />
                </div>
              ) : (
                /* Hover edit affordance */
                <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/25 group-hover:opacity-100">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-black/60 ring-1 ring-white/20 backdrop-blur-md">
                    <Pencil size={12} className="text-white" />
                  </div>
                </div>
              )}
            </div>
          );

          if (locked) {
            return (
              <div key={s} className="w-36 shrink-0 cursor-not-allowed" title={comingSoon ? "Not aired yet" : "Not started yet"}>
                {cardInner}
              </div>
            );
          }

          return (
            <Popover key={s}>
              <PopoverTrigger asChild>
                <button type="button" className="group w-36 shrink-0 cursor-pointer text-left">
                  {cardInner}
                </button>
              </PopoverTrigger>

              <PopoverContent align="start" className="w-52 bg-surface-3 border-border-strong p-3">
                <div className="mb-2">
                  <p className="text-xs font-semibold text-text-primary">Season {s}</p>
                  {airDate && <p className="text-[10px] text-text-tertiary">Aired {fmtDate(airDate)} · {eps} ep{eps > 1 ? "s" : ""}</p>}
                </div>

                <label className="mb-1 block text-[11px] text-text-tertiary">Year watched</label>
                <Select value={year ? String(year) : undefined} onValueChange={(v) => setYear(s, Number(v))}>
                  <SelectTrigger className="h-8 w-full border-border-subtle bg-surface-1 text-xs text-text-primary focus:ring-0">
                    <SelectValue placeholder="Pick a year" />
                  </SelectTrigger>
                  <SelectContent className="bg-surface-3 border-border-strong">
                    {yearsFor(idx).map((yr) => (
                      <SelectItem key={yr} value={String(yr)} className="text-xs focus:bg-surface-2 focus:text-text-primary">{yr}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <label className="mb-1 mt-3 block text-[11px] text-text-tertiary">Rating</label>
                <Select value={rating ? String(rating) : undefined} onValueChange={(v) => setRating(s, v)}>
                  <SelectTrigger className="h-8 w-full border-border-subtle bg-surface-1 text-xs text-amber-400 focus:ring-0">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent className="bg-surface-3 border-border-strong">
                    <SelectItem value="none" className="text-xs focus:bg-surface-2 focus:text-text-primary">—</SelectItem>
                    {[10, 9.5, 9, 8.5, 8, 7.5, 7, 6.5, 6, 5.5, 5].map((n) => (
                      <SelectItem key={n} value={String(n)} className="text-xs focus:bg-surface-2 focus:text-text-primary">{n}/10</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </PopoverContent>
            </Popover>
          );
        })}
      </div>
    </section>
  );
}
