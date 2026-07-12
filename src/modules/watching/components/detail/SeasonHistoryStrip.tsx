"use client";

import { useRef } from "react";
import { Pencil, Tv, Lock, Clock } from "lucide-react";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/shared/components/ui/popover";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/shared/components/ui/select";
import { CarouselNav } from "@/shared/components/ui/carousel-nav";
import { SectionHeader } from "@/shared/components/ui/section-header";
import { Badge } from "@/shared/components/ui/badge";
import { ScoreMark } from "@/modules/watching/components/shared/Marks";

interface Props {
  seasonEpisodes: number[];
  seasonPosters: (string | null)[] | null | undefined;
  seasonAirDates: (string | null)[] | null | undefined;
  seasonYears: Record<string, number> | null | undefined;
  seasonRatings: Record<string, number> | null | undefined;
  showPoster: string | null;        // fallback when a season has no poster
  releaseYear: number | null;
  currentSeason: number;            // live, from Currently Watching
  inProgress: boolean;              // ACTIVELY watching now → drives the "Now" badge
  incomplete: boolean;              // not fully watched (in progress / paused / dropped) → locks unreached seasons
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
  showPoster, releaseYear, currentSeason, inProgress, incomplete, onYearChange, onRatingChange,
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
  // Locked = unreleased OR (not-fully-watched show, season after where you stopped).
  const lockedAt = (idx: number) => comingSoonAt(idx) || (incomplete && idx + 1 > currentSeason);
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

  // A scrolling rail — no panel, same rule as Episodes / Cast / More Like This.
  return (
    <section>
      <SectionHeader
        title="Watch History"
        actions={
          <>
            {/* An action-select, not a filter: it has no persisted value, it applies a year to
                every season at once. Same trigger shell as FilterSelect so it lines up. */}
            <Select onValueChange={(v) => setAll(Number(v))}>
              <SelectTrigger className="h-8 w-auto gap-2 border-border-subtle bg-surface-2 px-3.5 text-xs text-text-secondary transition-colors hover:bg-surface-3 hover:text-text-primary focus:ring-0">
                <SelectValue placeholder="Set all year" />
              </SelectTrigger>
              <SelectContent className="border-border-strong bg-surface-3">
                {setAllYears.map((y) => (
                  <SelectItem key={y} value={String(y)} className="text-xs focus:bg-surface-2 focus:text-text-primary">All in {y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
        className="-mx-4 flex gap-3 overflow-x-auto scroll-px-4 px-4 py-1.5 scrollbar-hide sm:mx-0 sm:px-0"
      >
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
            <div className={`relative aspect-2/3 w-full overflow-hidden rounded-tile border border-border-subtle bg-surface-1 transition-transform duration-300 ease-out ${
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

              {/* Top-left = WHEN. A flag on artwork → the shared glass badge, not a hand-rolled
                  black pill (this card had three different ones). */}
              {!locked && (
                <Badge
                  variant="glass"
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
                <Badge variant="glass" size="sm" dot color={TEAL} className="absolute right-1.5 top-1.5">
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
              ) : locked ? (
                /* Mask — released but not started yet */
                <div className="absolute inset-0 flex items-center justify-center bg-black/65">
                  <Lock size={15} className="text-white/55" />
                </div>
              ) : (
                /* Hover edit affordance */
                <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/25 group-hover:opacity-100">
                  <div className="glass-thin flex h-7 w-7 items-center justify-center rounded-full">
                    <Pencil size={12} className="text-white" />
                  </div>
                </div>
              )}
            </div>
          );

          if (locked) {
            return (
              <div key={s} className="w-(--rail-peek) shrink-0 cursor-not-allowed sm:w-(--poster-lg)" title={comingSoon ? "Not aired yet" : "Not started yet"}>
                {cardInner}
              </div>
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

                <label className="mb-1 block text-micro text-text-tertiary">Year watched</label>
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

                <label className="mb-1 mt-3 block text-micro text-text-tertiary">Rating</label>
                <Select value={rating ? String(rating) : undefined} onValueChange={(v) => setRating(s, v)}>
                  <SelectTrigger className="h-8 w-full border-border-subtle bg-surface-1 text-xs text-accent-watching-vivid focus:ring-0">
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
