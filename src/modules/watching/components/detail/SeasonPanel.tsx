/* eslint-disable @next/next/no-img-element */
"use client";

import { useCallback, useMemo, useState } from "react";
import { Check, Clock, ImageOff, MoreHorizontal, Pencil, Star, Tv } from "lucide-react";
import { SlidingPanel } from "@/shared/components/ui/sliding-panel";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { Badge } from "@/shared/components/ui/badge";
import { cn } from "@/shared/utils/utils";
import { toast } from "@/shared/utils/toast";
import { isDemoReadOnlyError } from "@/shared/utils/demo-guard";
import { StarRating } from "../shared/StarRating";
import { ScoreMark } from "../shared/Marks";
import { tmdbImage, tmdbImageFor } from "../../lib/tmdb-image";
import { useSeasonEpisodes, type EpisodeInfo } from "../../hooks/useSeasonEpisodes";
import {
  useAddEpisodeHighlight,
  useEpisodeHighlights,
  useRemoveEpisodeHighlight,
} from "../../hooks/useEpisodeHighlights";
import {
  caughtUpOn,
  hasFullyWatchedSeason,
  hasReached,
  isSeasonComplete,
  isSeasonDatable,
  isSeasonLive,
} from "../../lib/series-state";
import type { MediaView } from "../../lib/media-view";
import type { WatchingMedia } from "../../types";

/**
 * THE SEASON IS THE CONTAINER OF ITS EPISODES.
 *
 * The fiche used to run two navigations of the same thing: a Watch History strip whose popover set
 * a year and a rating, and an Episodes rail with its own season chips. Two selectors, one object.
 * Now a season is a thing you OPEN — every card on the strip, whatever its state — and the panel
 * holds all of it: where you stand, what you claimed (year, rating), and the episodes themselves.
 *
 * What it does NOT do: decide a status. The state it prints comes from `series-state`, the facts
 * come from the lens, the writes go back through the page's handlers — the same single writers as
 * before. A season still coming out shows WHEN the next episode airs; it never touches the row.
 */

const TMDB_IMG = "https://image.tmdb.org/t/p/w300";
// Stills are 1920×1080 at TMDB. At 144 px on a retina screen a thumbnail is 288 physical pixels
// wide — `w300` is on the edge of soft; `w500` is crisp, lazy-loaded, so only what scrolls into
// view is paid for.
const TMDB_STILL = "https://image.tmdb.org/t/p/w500";
const TEAL = "var(--color-accent-watching-vivid)";
const GOLD = "var(--color-gold)";
const MAX_HIGHLIGHTS = 20;
// The header poster: between the strip card and a cover — the card takes its height from it.
const POSTER_W = 112;
const POSTER_H = 168;

const TODAY = () => new Date().toISOString().slice(0, 10);
const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
const fmtMonth = (d: string) =>
  new Date(d).toLocaleDateString("en-GB", { month: "short", year: "numeric" });
const fmtWeekday = (d: string) =>
  new Date(d + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long" });
const fmtDayShort = (d: string) =>
  new Date(d + "T00:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
/** Not aired = no date at all, or a date still ahead of us. An unknown date is not a past date. */
const isUnaired = (airDate: string | null) => !airDate || airDate > TODAY();
const daysUntil = (d: string) =>
  Math.ceil((new Date(d + "T00:00:00").getTime() - new Date(TODAY() + "T00:00:00").getTime()) / 86400000);

/** "In 3 days" while it's useful; the date once it isn't. Same rule as the episode rail. */
function airLabel(d: string): string {
  const days = daysUntil(d);
  if (days <= 0) return fmtDate(d);
  if (days === 1) return "Airs tomorrow";
  if (days <= 14) return `Airs in ${days} days`;
  return `Airs ${fmtDate(d)}`;
}

/** "in 37 days" / "tomorrow" / "today" — the wait, as you'd say it. */
function waitLabel(d: string): string {
  const days = daysUntil(d);
  if (days <= 0) return "today";
  if (days === 1) return "tomorrow";
  if (days < 14) return `in ${days} days`;
  const weeks = Math.round(days / 7);
  return weeks < 8 ? `in ${weeks} weeks` : `in ${Math.round(days / 30)} months`;
}

/**
 * THE RHYTHM OF A SEASON, read off the dates it has already kept. Three aired episodes seven days
 * apart is a weekly show, and the next one lands on the same weekday — that is the one thing a
 * viewer wants to know about a season still coming out. Anything irregular (a batch drop, a
 * two-part premiere, a hiatus) says nothing rather than guessing.
 */
function cadence(aired: EpisodeInfo[]): "weekly" | null {
  const dates = aired.map((e) => e.air_date).filter((d): d is string => !!d);
  if (dates.length < 3) return null;
  const gaps: number[] = [];
  for (let i = 1; i < dates.length; i++) {
    gaps.push(Math.round((new Date(dates[i]).getTime() - new Date(dates[i - 1]).getTime()) / 86400000));
  }
  const weekly = gaps.filter((g) => g === 7).length;
  return weekly >= Math.max(2, Math.floor(gaps.length * 0.6)) ? "weekly" : null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  media: WatchingMedia;
  view: MediaView;
  /** The season to show, in DISPLAY units. Kept by the page across the close animation. */
  season: number;
  /** Where you stand, in DISPLAY units — live from the page's steppers, not the row. */
  position: { season: number; episode: number };
  /** An unwatched title (want-to-watch / reference): the panel reads, it never claims. */
  readOnly: boolean;
  onYearChange: (season: number, year: number) => void;
  onRatingChange: (season: number, value: number | null) => void;
  /** "I watched through this season" — the page re-derives the status. */
  onSetPosition: (season: number, episode: number) => void;
}

export function SeasonPanel({
  open, onClose, media, view, season: s, position, readOnly,
  onYearChange, onRatingChange, onSetPosition,
}: Props) {
  const idx = s - 1;
  const info = view.seasons[idx];
  const announced = info?.episodes ?? 0;
  const aired = info?.aired ?? 0;

  // The world's facts in DISPLAY space, plus where YOU stand right now. Same construction as the
  // StatusCard — the steppers may be ahead of the row for half a second, and the panel must agree
  // with the card next to it, not with the database.
  const facts = { ...view.seriesFacts, watched: media.watched, current_season: position.season, current_episode: position.episode };
  const comingSoon = aired === 0;
  const complete = isSeasonComplete(facts, s);
  const fullyWatched = !readOnly && hasFullyWatchedSeason(facts, s);
  const datable = !readOnly && isSeasonDatable(facts, s);
  // "Now" is a season you are ACTIVELY inside — the strip gates its badge on `in_progress` and so
  // does this. A paused or dropped show is inside a season too, but the word for that is the
  // show's word (Paused / Dropped), not "Now" — the StatusCard next to this panel says so.
  const here = position.season === s;
  const live = !readOnly && media.in_progress && isSeasonLive(facts, s);
  // Stopped inside this season — paused or dropped — and not through it.
  const stoppedIn = !readOnly && here && !media.in_progress && (media.paused || media.dropped);
  // "Watched through" — offered on any fully aired season that isn't exactly where you stand.
  const standingAt = here && position.episode >= announced;
  const canJump = !readOnly && complete && !standingAt;
  // The same gesture reads differently by direction: ahead of you it is a CLAIM ("I watched through
  // it"), behind you it is a CORRECTION ("I actually stopped here"). One is the season's main
  // action; the other is a footnote to the record.
  const behind = position.season > s;

  /**
   * THE EPISODES — one TMDB season, sliced to this display season.
   * Under the overlay TMDB has a single flat season and a cour is a RANGE of it; without one the
   * display season IS the TMDB season and the range is the whole thing. `toStorage` answers both
   * at once: the storage coordinate of this season's first episode tells us which TMDB season to
   * fetch and where to start reading.
   */
  const first = view.toStorage(s, 1);
  const cour = view.overlaid ? view.cours?.[idx] : null;
  const { data: episodesRaw = [], isLoading } = useSeasonEpisodes(media.tmdb_id ?? 0, first.season, open && !!media.tmdb_id);
  const episodes = useMemo(
    () => cour
      ? episodesRaw.filter((e) => e.number >= cour.start_episode && (cour.end_episode == null || e.number <= cour.end_episode))
      : episodesRaw,
    [episodesRaw, cour],
  );
  // Display number is per-season (a cour starts at "E1"); the mark stays in storage coordinates.
  const dispNum = (e: EpisodeInfo) => e.number - first.episode + 1;

  // The season's own dates — from its episodes once they're here, else the sync's per-season facts.
  const airedEps = episodes.filter((e) => !isUnaired(e.air_date));
  const startDate = airedEps[0]?.air_date ?? (view.overlaid ? null : media.season_air_dates?.[idx]) ?? null;
  const endDate = complete ? (airedEps[airedEps.length - 1]?.air_date ?? info?.endDate ?? null) : null;
  // The next one to AIR — shown, never acted on. This is the Watching half of the "new episode"
  // notification: the panel of a season still coming out tells you when to come back.
  const nextToAir = !complete ? episodes.find((e) => isUnaired(e.air_date)) ?? null : null;
  const rhythm = nextToAir ? cadence(airedEps) : null;

  /* ── Marks ─────────────────────────────────────────────────────────────────────────────── */
  // Read-only (a title you don't own, on discover) → nothing to read: no marks query at all.
  const { data: marks = [] } = useEpisodeHighlights(readOnly ? "" : media.id);
  const addHighlight = useAddEpisodeHighlight(media.id);
  const removeHighlight = useRemoveEpisodeHighlight(media.id);
  const highlightMap = useMemo(
    () => new Map(marks.filter((h) => h.highlighted).map((h) => [`${h.season}-${h.episode}`, h.id])),
    [marks],
  );
  const highlightCount = highlightMap.size;

  const toggleHighlight = async (e: EpisodeInfo) => {
    const key = `${first.season}-${e.number}`;
    const existingId = highlightMap.get(key);
    if (!existingId && highlightCount >= MAX_HIGHLIGHTS) {
      toast.error(`You can pin up to ${MAX_HIGHLIGHTS} best episodes.`);
      return;
    }
    try {
      if (existingId) await removeHighlight.mutateAsync(existingId);
      else await addHighlight.mutateAsync({
        tmdbId: media.tmdb_id!, userId: media.user_id, orgId: media.org_id, season: first.season, episode: e.number,
        meta: { title: e.name, still_path: e.still_path, air_date: e.air_date, overview: e.overview || null },
      });
    } catch (err) {
      if (isDemoReadOnlyError(err)) return;
      toast.error(err instanceof Error ? err.message : "Failed to update.");
    }
  };

  /* ── Your record ───────────────────────────────────────────────────────────────────────── */
  const year = view.yearMap?.[String(s)];
  // ONE SEASON, ONE VERDICT. A show with a single season has nothing to rate "per season" — the
  // rating you gave the title in My Take IS this season's rating, and asking for it twice was the
  // app inviting a contradiction. The panel shows it and does not offer a second control.
  const single = view.seasons.length === 1;
  // A stamp on a season you haven't REACHED is a claim you're no longer making (you stepped back,
  // or dropped the show before it). The data stays; we stop reading it — the strip's rule, applied
  // here too, so the card and the panel never disagree about the same number.
  const reachedSeason = media.watched || s <= position.season;
  const rating = single ? (media.user_rating ?? 0) : (reachedSeason ? (view.ratingMap?.[String(s)] ?? 0) : 0);

  // Year options — never before the season finished airing, never after now.
  const currentYear = new Date().getFullYear();
  const floor = (info?.endDate ? new Date(info.endDate).getFullYear() : null) ?? media.year ?? 1900;
  const years: number[] = [];
  for (let y = currentYear; y >= Math.min(floor, currentYear); y--) years.push(y);


  /* ── Header facts ──────────────────────────────────────────────────────────────────────── */
  const posterPath = info?.poster ?? null;
  const poster = posterPath
    ? (posterPath.startsWith("http") ? posterPath : `${TMDB_IMG}${posterPath}`)
    : (media.poster_url ?? null);

  const span = startDate
    ? (endDate && endDate !== startDate ? `${fmtMonth(startDate)} – ${fmtMonth(endDate)}` : fmtMonth(startDate))
    : null;

  // ONE status line, derived — the same words the StatusCard would use for this season.
  const QUIET = "rgba(255,255,255,0.7)";
  const status = comingSoon
    ? { label: "Coming soon", color: QUIET }
    : readOnly
      ? null
      : fullyWatched
        ? { label: "Watched", color: TEAL }
        : live && position.episode >= aired
          ? { label: caughtUpOn(facts) === "episode" ? "Caught up" : "Watched", color: TEAL }
          : live
            ? { label: `Now · E${position.episode} of ${aired}`, color: TEAL }
            : stoppedIn
              ? { label: `${media.dropped ? "Dropped" : "Paused"} · E${position.episode} of ${aired}`, color: QUIET }
              : here
                ? { label: `E${position.episode} of ${aired}`, color: QUIET }
                : { label: "Not started", color: QUIET };
  const bestHere = episodes.filter((e) => highlightMap.has(`${first.season}-${e.number}`)).length;

  /* ── The pieces every layout composes ─────────────────────────────────────────────────── */
  // No cour title here, on purpose: the chrome names the season, and one panel with a two-line
  // AniList heading beside another with none is two shapes for one object. Same card everywhere.
  const factsLine = (
    <>
      {announced} episode{announced !== 1 ? "s" : ""}
      {!complete && aired > 0 && <span className="font-normal text-white/60"> · {aired} aired</span>}
    </>
  );
  const statusRow = status ? (
    <>
      <Badge variant="flag" size="md" color={status.color}>
        {status.label}
        {status.label === "Watched" && year ? ` · ${year}` : ""}
      </Badge>
      {/* A score the season carries but cannot edit here (not fully aired, stepped back into it,
          or a single-season title whose rating is the title's) is still YOUR fact — the strip
          shows it, so the panel does too. Read-only: the claim is not open, the memory is. */}
      {(!datable || single) && rating > 0 && <ScoreMark value={rating} source="mine" onArtwork />}
      {bestHere > 0 && (
        <span className="flex items-center gap-1 text-micro text-white/70 tabular-nums">
          <Star size={11} style={{ color: GOLD, fill: GOLD }} />
          {bestHere} best
        </span>
      )}
    </>
  ) : null;
  // THE YEAR, edited the way the StatusCard edits "Finished": the value with a pen, a small menu.
  const yearEdit = datable ? (
    <YearPen value={year ?? null} years={years} onChange={(y) => onYearChange(s, y)} />
  ) : null;
  const stars = datable && !single ? (
    <StarRating size="sm" onArtwork value={rating} onChange={(v) => onRatingChange(s, v)} />
  ) : null;
  const jump = canJump && !behind ? (
    <button
      type="button"
      onClick={() => onSetPosition(s, announced)}
      className="flex w-full items-center justify-center gap-1.5 rounded-control bg-white/10 py-1.5 text-xs font-medium text-white/85 transition-colors hover:bg-white/15 hover:text-white"
    >
      <Check size={13} />
      Watched through season {s}
    </button>
  ) : null;
  // THE "…" — corrections, not actions. The same grammar as the StatusCard and the poster cards:
  // what changes a claim you already made lives behind the dots, and the card stays about the
  // season. Rendered only when it has something to offer; room for more later.
  const corrections = [
    ...(canJump && behind ? [{ label: "I stopped after this season", onPick: () => onSetPosition(s, announced) }] : []),
  ];
  const menu = corrections.length > 0 ? (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="More"
          className="on-artwork absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full text-white/85 transition-colors hover:text-white"
        >
          <MoreHorizontal size={14} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 overflow-hidden rounded-card border-border-default bg-surface-3 p-0 shadow-md">
        {corrections.map((c) => (
          <button
            key={c.label}
            type="button"
            onClick={c.onPick}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-xs text-text-secondary transition-colors hover:bg-surface-2 hover:text-text-primary"
          >
            <Check size={13} />
            {c.label}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  ) : null;

  return (
    <SlidingPanel
      open={open}
      onClose={onClose}
      width="wide"
      // The season lives in the chrome, so it survives the scroll.
      title={
        <h2 className="flex min-w-0 items-baseline gap-2 text-sm font-semibold text-text-primary">
          <span className="shrink-0">Season {s}</span>
          <span className="truncate font-normal text-text-tertiary">{media.title}</span>
        </h2>
      }
    >
      <div className="space-y-5 px-4 py-4">

        {/* ── THE SEASON, AND YOU — built like the Trending card on the main page. The poster
            sits flush on the card's left edge at its natural 2:3; its own artwork, blurred into a
            glow, fills the card behind it, and a gradient melts the sharp poster into that glow
            toward the text. One frame holds the facts, the status and your record. ── */}
        <div className="relative -mx-1 overflow-hidden rounded-card bg-surface-0" style={{ minHeight: POSTER_H }}>
          {/* ambient — w92 is indistinguishable once blurred and ~2 KB */}
          {poster && (
            <div className="absolute inset-0">
              {/* Saturated on purpose: a blur averages a poster into grey, and a grey halo says
                  nothing. Pushed back up, the glow is the poster's own colour. Lightly darkened
                  only so white text stays legible. */}
              <img src={tmdbImage(poster, "w92") ?? poster} alt="" aria-hidden className="h-full w-full scale-[1.7] object-cover blur-3xl saturate-150" />
              <div className="absolute inset-0 bg-black/20" />
            </div>
          )}
          {/* darken toward the info side; the sharp poster melts into its own blurred art */}
          <div className="absolute inset-0 bg-linear-to-r from-transparent via-black/25 to-black/45" />

          {/* the poster — left-anchored, FIXED width, full card height. The text column decides
              how tall the card is; the poster fills that height by cropping (top-anchored, where
              the faces are), never by widening under the text. */}
          <div className="absolute bottom-0 left-0 top-0 bg-surface-2" style={{ width: POSTER_W }}>
            {poster ? (
              <img src={tmdbImageFor(poster, POSTER_W) ?? poster} alt={`Season ${s}`} className="h-full w-full object-cover object-top" />
            ) : (
              <div className="flex h-full w-full items-center justify-center"><Tv size={18} className="text-text-tertiary" /></div>
            )}
          </div>

          {/* the facts, the status, your record — on artwork, so white carries the text */}
          <div className="relative flex min-w-0 flex-col py-3 pr-4" style={{ marginLeft: POSTER_W, paddingLeft: 16 }}>
            <p className="pr-8 text-sm font-semibold text-white tabular-nums">{factsLine}</p>
            {span && <p className="mt-0.5 text-xs text-white/60">{span}</p>}
            {statusRow && <div className="mt-2 flex flex-wrap items-center gap-2">{statusRow}</div>}
            {(datable || canJump) && (
              <div className="mt-auto flex flex-col gap-1.5 pt-3">
                {datable && <div className="flex h-6 items-center justify-between gap-3"><span className="whitespace-nowrap text-xs text-white/70">Year watched</span>{yearEdit}</div>}
                {/* On a phone the column beside the poster is ~230 px: label + ten stars + number do not
                    fit, and the number was the thing that got clipped. The stars say what they are;
                    the label is the part that can go. */}
                {stars && <div className="flex items-center justify-end gap-3 sm:justify-between"><span className="hidden whitespace-nowrap text-xs text-white/70 sm:inline">Your rating</span>{stars}</div>}
                {jump}
              </div>
            )}
          </div>
          {menu}
        </div>

        {/* ── Next to air — two lines on their own ground. Read, never written: this is the
            Watching half of the "new episode" notification. Weekday and distance (what you want
            to know when you watch week to week), and the rhythm when the dates prove one. ── */}
        {nextToAir && (
          <div className="rounded-card bg-surface-2 px-3.5 py-2.5">
            <p className="truncate text-xs font-semibold text-text-primary">
              <span className="text-accent-watching-vivid">Next episode</span>
              <span className="text-text-tertiary"> · </span>
              E{dispNum(nextToAir)}{nextToAir.name ? ` · ${nextToAir.name}` : ""}
            </p>
            <p className="mt-0.5 text-micro text-text-tertiary">
              {nextToAir.air_date
                ? <>{fmtDayShort(nextToAir.air_date)} · {waitLabel(nextToAir.air_date)}{rhythm === "weekly" && ` · every ${fmtWeekday(nextToAir.air_date)}`}</>
                : "Not scheduled yet"}
            </p>
          </div>
        )}

        {/* ── Episodes ── */}
        <section>
          <div className="mb-2 flex items-baseline justify-between">
            <h4 className="text-caption font-semibold uppercase tracking-wide text-text-tertiary">Episodes</h4>
            {!isLoading && episodes.length > 0 && !complete && (
              <span className="text-micro text-text-tertiary tabular-nums">{aired} of {announced} aired</span>
            )}
          </div>

          {isLoading ? (
            <ul className="space-y-1">
              {Array.from({ length: 6 }).map((_, i) => (
                <li key={i} className="flex gap-3 py-2">
                  <div className="aspect-video w-36 shrink-0 animate-pulse rounded-chip bg-surface-2" />
                  <div className="flex-1 space-y-2 pt-1">
                    <div className="h-2 w-16 animate-pulse rounded-full bg-surface-2" />
                    <div className="h-2.5 w-2/3 animate-pulse rounded-full bg-surface-2" />
                    <div className="h-2 w-full animate-pulse rounded-full bg-surface-2" />
                  </div>
                </li>
              ))}
            </ul>
          ) : episodes.length === 0 ? (
            <p className="py-6 text-center text-xs text-text-tertiary">No episodes listed yet.</p>
          ) : (
            <ul className="-mx-2">
              {episodes.map((ep) => {
                const n = dispNum(ep);
                const unaired = isUnaired(ep.air_date);
                const reached = !readOnly && hasReached(facts, s, n);
                const upNext = !readOnly && !media.dropped && !unaired && here && n === position.episode + 1;
                const actionable = !readOnly && !unaired && reached;
                const highlighted = highlightMap.has(`${first.season}-${ep.number}`);
                return (
                  <EpisodeRow
                    key={ep.number}
                    ep={ep}
                    number={n}
                    unaired={unaired}
                    reached={reached || readOnly}
                    upNext={upNext}
                    highlighted={highlighted}
                    onToggle={actionable ? () => toggleHighlight(ep) : undefined}
                    backdrop={media.backdrop_url ?? null}
                  />
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </SlidingPanel>
  );
}

/* ── One episode ─────────────────────────────────────────────────────────────────────────────── */

function EpisodeRow({
  ep, number, unaired, reached, upNext, highlighted, onToggle, backdrop,
}: {
  ep: EpisodeInfo;
  number: number;
  unaired: boolean;
  /** Behind your position (or nothing to claim on this title) → full ink. Ahead → quieter. */
  reached: boolean;
  upNext: boolean;
  highlighted: boolean;
  /** Undefined = no star: unaired, or ahead of you. */
  onToggle?: () => void;
  backdrop: string | null;
}) {
  return (
    <li className={cn("group flex items-start gap-3 rounded-card px-2 py-2", !reached && "opacity-60")}>
      {/* Still — lazy, 16:9, the show's backdrop standing in when TMDB has none. `self-start` so
          the row's text can grow (More) without stretching the picture out of its ratio. */}
      <div className="relative aspect-video w-36 shrink-0 self-start overflow-hidden rounded-chip border border-border-subtle bg-surface-2">
        {ep.still_path && !unaired ? (
          <img src={`${TMDB_STILL}${ep.still_path}`} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          /* No still (TMDB is late) or not out yet: the show's backdrop, blurred — plainly this
             show, plainly not a photo of the episode. Heavier blur + a clock for the unaired. */
          <>
            {backdrop && (
              <img src={backdrop} alt="" aria-hidden loading="lazy" className={cn("h-full w-full scale-110 object-cover opacity-80", unaired ? "blur-xs saturate-50" : "blur-[2px] saturate-75")} />
            )}
            <div className={cn("absolute inset-0 flex items-center justify-center", unaired && "bg-black/40")}>
              {unaired ? <Clock size={13} className="text-white/80" /> : <ImageOff size={14} className="text-white/45" />}
            </div>
          </>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-micro font-medium text-text-tertiary tabular-nums">
              <span>E{number}</span>
              {ep.air_date && <span>· {unaired ? airLabel(ep.air_date) : fmtDate(ep.air_date)}</span>}
              {!ep.air_date && unaired && <span>· Not scheduled</span>}
              {upNext && <Badge variant="tint" size="sm" color={TEAL}>Up next</Badge>}
            </p>
            <p className="text-xs font-semibold text-text-primary">{ep.name}</p>
          </div>
          {/* The star: the ONE action on an episode. Always lit when it's a best episode; on a
              hover device the empty one only shows itself when you're over the row. */}
          {onToggle ? (
            <button
              type="button"
              onClick={onToggle}
              aria-label={highlighted ? "Remove from best episodes" : "Mark as best episode"}
              aria-pressed={highlighted}
              className={cn(
                "-mr-1 -mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-[opacity,background-color] duration-150 ease-out hover:bg-surface-2",
                highlighted ? "opacity-100" : "opacity-100 can-hover:opacity-0 can-hover:group-hover:opacity-100",
              )}
            >
              <Star size={14} style={highlighted ? { color: GOLD, fill: GOLD } : undefined} className={highlighted ? undefined : "text-text-tertiary"} />
            </button>
          ) : highlighted ? (
            <span className="-mr-1 -mt-1 flex h-7 w-7 shrink-0 items-center justify-center">
              <Star size={14} style={{ color: GOLD, fill: GOLD }} />
            </span>
          ) : null}
        </div>
        {ep.overview && <Overview text={ep.overview} />}
      </div>
    </li>
  );
}

/**
 * Two lines, then "…more" — ON the second line, not under it. `line-clamp` cannot end a line with
 * a word of ours, so the word is anchored at the block's bottom-right with a short fade behind it,
 * the way YouTube and Apple end a clamped description. It exists only when the clamp actually cut
 * something: measured, not guessed from a character count.
 */
function Overview({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const [clamped, setClamped] = useState(false);
  const measure = useCallback((el: HTMLParagraphElement | null) => {
    if (el) setClamped(el.scrollHeight > el.clientHeight + 1);
  }, []);
  return (
    <div className="relative mt-1">
      <p ref={expanded ? undefined : measure} className={cn("text-micro leading-relaxed text-text-tertiary", !expanded && "line-clamp-2")}>{text}</p>
      {clamped && !expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="absolute bottom-0 right-0 bg-linear-to-r from-transparent via-surface-1 via-30% to-surface-1 pl-8 text-micro font-medium leading-relaxed text-text-secondary transition-colors hover:text-text-primary"
        >
          …more
        </button>
      )}
      {expanded && (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="mt-0.5 text-micro font-medium text-text-secondary transition-colors hover:text-text-primary"
        >
          Less
        </button>
      )}
    </div>
  );
}

/**
 * THE YEAR WITH A PEN — the same gesture as "Finished" on the StatusCard: the value reads as text,
 * the pen says it can change, the menu holds the picker. A dropdown sitting in the row would make
 * the record read as a form; this reads as a fact you may correct.
 */
function YearPen({ value, years, onChange }: { value: number | null; years: number[]; onChange: (y: number) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="group inline-flex items-center gap-1.5 text-xs font-semibold text-white tabular-nums transition-colors hover:text-white/90"
        >
          {value ?? <span className="font-medium text-white/60">Set year</span>}
          <Pencil size={11} className="text-white/45 transition-colors group-hover:text-white/75" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-44 border-border-strong bg-surface-3 p-3">
        <label className="mb-1.5 block text-micro text-text-tertiary">When did you watch it?</label>
        <Select value={value ? String(value) : undefined} onValueChange={(v) => onChange(Number(v))}>
          <SelectTrigger variant="legacy" className="h-8 w-full border-border-subtle bg-surface-1 text-xs text-text-primary focus:ring-0">
            <SelectValue placeholder="Pick a year" />
          </SelectTrigger>
          <SelectContent variant="legacy" className="border-border-strong bg-surface-3">
            {years.map((yr) => (
              <SelectItem key={yr} value={String(yr)} className="text-xs focus:bg-surface-2 focus:text-text-primary">{yr}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </PopoverContent>
    </Popover>
  );
}
