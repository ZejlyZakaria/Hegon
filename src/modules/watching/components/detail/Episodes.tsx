/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BarChart3, Clock, ImageOff, MoreVertical, Star } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { CarouselNav } from "@/shared/components/ui/carousel-nav";
import { cn } from "@/shared/utils/utils";
import { isEpisodeActionable } from "../../lib/series-state";
import { toast } from "@/shared/utils/toast";
import { isDemoReadOnlyError } from "@/shared/utils/demo-guard";
import { SegmentedControl } from "@/shared/components/ui/segmented-control";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { FilterSelect } from "@/shared/components/ui/filter-select";
import { Hint } from "@/shared/components/ui/tooltip";
import { SectionHeader } from "@/shared/components/ui/section-header";
import { useSeasonEpisodes } from "../../hooks/useSeasonEpisodes";
import {
  useEpisodeHighlights,
  useAddEpisodeHighlight,
  useRemoveEpisodeHighlight,
  useSetEpisodeRating,
} from "../../hooks/useEpisodeHighlights";
import { EpisodeHeatmapModal } from "./EpisodeHeatmapModal";
import type { WatchingMedia, AnimeCour } from "../../types";

/**
 * THE WHOLE CARD, NOT JUST ITS PICTURE.
 *
 * A skeleton that reserves the still and nothing else, while a real card is still PLUS number,
 * title and a two-line overview, stands short and grows the moment the episodes land — shoving
 * whatever sits below down the page, under the reader's eye. A placeholder that is not the size
 * of what it replaces does not prevent the jump; it schedules it.
 *
 * Exported so the full-page skeletons (`DetailSkeleton`, `DiscoverSkeleton`) hold this exact
 * shape too, instead of a generic guess that then gets swapped for THIS the moment `Episodes`
 * itself mounts — which is the same 91px bug with extra steps: right height, wrong picture,
 * twice.
 *
 * Mirrors StillCard's own markup below (mt-2, the three lines) so the two cannot drift.
 */
export function EpisodeCardsSkeleton({ n = 5 }: { n?: number }) {
  // `py-2` has always reserved room for the hover scale on the VERTICAL axis. The horizontal one
  // was reserved too, until "every detail rail bleeds alike" replaced the edge padding with
  // `sm:px-0` — which put the scroll container's edge exactly on the content's edge, so a card
  // growing ~4px sideways got clipped by its own `overflow-x-auto`. The negative margin cancels the
  // padding, so the row still bleeds exactly where it did; only the clip is gone. More Like This
  // never had this bug because past `sm:` it stops scrolling and becomes a grid with
  // `overflow-visible` — not an option here, these rails hold dozens of episodes.
  return (
    <div className="-mx-4 flex gap-3 overflow-x-auto scroll-px-4 px-4 py-2 scrollbar-hide sm:-mx-1.5 sm:px-1.5 sm:scroll-px-1.5">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="w-66 shrink-0">
          <div className="aspect-video w-full animate-pulse rounded-card bg-surface-2" />
          {/* Each <p> keeps the REAL typography class, so the block takes its height from the same
              line-heights as the text it replaces and cannot drift when the type scale moves.
              (Measured: 15 + 16 + 4 + 36 = 71px.)

              But a line of 11px text only INKS about a third of its line box — the rest is
              leading and negative space. Bars that filled the whole box therefore painted two to
              three times the mass of the text, and stacked with no gap they read as slabs, not as
              writing: that was the "too big and too crowded". Filling them at lower opacity only
              made the slab paler. So the bar is now SHORTER than its line and centred in it, and
              the leading does the spacing.
              Hierarchy rides the same property as real ink: the bold title's bar is 10px, the
              quiet caption and overview 8px. No opacity trick — that had made the title the one
              bar that visibly jumped out of the four. */}
          <div className="mt-2">
            <p className="mb-0.5 text-micro font-medium">
              <span className="inline-block h-2 w-16 animate-pulse rounded-full bg-surface-2 align-middle" />
            </p>
            <p className="text-xs font-semibold">
              <span className="inline-block h-2.5 w-2/3 animate-pulse rounded-full bg-surface-2 align-middle" />
            </p>
            <p className="mt-1 text-micro leading-relaxed">
              {/* Two bars, because the overview is `line-clamp-2` and the height has to be
                  promised — one bar would collapse this line box and the real text would then
                  shove the card 18px taller. The SECOND one is half-width: a real paragraph's
                  last line stops early, and two near-equal bars read as a filled block instead. */}
              <span className="inline-block h-2 w-full animate-pulse rounded-full bg-surface-2 align-middle" />
              <span className="inline-block h-2 w-1/2 animate-pulse rounded-full bg-surface-2 align-middle" />
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

type View = "all" | "highlights";
const HIGHLIGHT = "var(--color-gold)";                              // gold — "best episode"
const RATE_COLOR = "var(--color-accent-watching-vivid)"; // teal — your rating

const TODAY = () => new Date().toISOString().slice(0, 10);
const fmtAir = (d: string) =>
  new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
/** Not aired = no date at all, or a date still ahead of us. An unknown date is not a past date. */
const isUnaired = (airDate: string | null) => !airDate || airDate > TODAY();

/**
 * "In 3 days" answers the real question — is it soon? — but only while the answer is USEFUL.
 * "In 65 days" is arithmetic nobody asked for: past a fortnight you want to know WHEN, not how
 * many nights to sleep. So the relative form is reserved for what's imminent (which is exactly
 * the weekly rhythm of a season still coming out); everything further away shows its date.
 */
const SOON_DAYS = 14;
function airLabel(d: string): { lead: string; sub: string | null } {
  const days = Math.ceil((new Date(d + "T00:00:00").getTime() - new Date(TODAY() + "T00:00:00").getTime()) / 86400000);
  if (days <= 0) return { lead: fmtAir(d), sub: null };
  if (days === 1) return { lead: "Airs tomorrow", sub: fmtAir(d) };
  if (days <= SOON_DAYS) return { lead: `Airs in ${days} days`, sub: fmtAir(d) };
  return { lead: `Airs ${fmtAir(d)}`, sub: null };
}
const MAX_HIGHLIGHTS = 20;
const TMDB_STILL = "https://image.tmdb.org/t/p/w300";
// Heatmap is hidden until we ingest complete IMDb ratings (OMDb data is patchy —
// e.g. GoT S5E3 has no rating there). Flip to re-enable once that lands.
const HEATMAP_ENABLED = false;

// One episode card: still + star toggle, with number/title/overview below (like the
// IMDb episode viewer). `highlighted` = persistent gold star + ring; the star
// toggles the episode as a "best episode" (the merged Best Episodes feature).
function StillCard({
  still,
  line1,
  line2,
  overview,
  highlighted,
  rating,
  onToggle,
  onRate,
  unairedOn,
  backdrop,
}: {
  still: string | null;
  line1: string;
  line2: string;
  overview?: string;
  highlighted: boolean;
  rating?: number | null;
  onToggle: () => void;
  onRate?: (rating: number | null) => void;
  /** Set when the episode HASN'T AIRED: its air date, or null if TMDB doesn't even know yet. */
  unairedOn?: string | null | undefined;
  /** The SHOW's backdrop — stands in for the still an unaired episode cannot have. */
  backdrop?: string | null;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  // Close on scroll — the same reflex the poster "…" menu has: a menu anchored to a card that just
  // scrolled away should get out of the way, not float detached over the page.
  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(false);
    window.addEventListener("scroll", close, { capture: true, passive: true });
    return () => window.removeEventListener("scroll", close, { capture: true });
  }, [menuOpen]);
  const rated = rating != null;
  // AN EPISODE THAT HASN'T AIRED CANNOT BE RATED OR STARRED. TMDB lists announced episodes —
  // House of the Dragon shows 8 in season 3, three of which exist. You cannot have an opinion
  // about something you could not have seen, so the app doesn't offer you the chance to claim
  // one. It unlocks on its air date, by itself: it's the DATE that decides, so nobody has to
  // remember to unlock anything.
  const unaired = unairedOn !== undefined;
  const hasActions = !!onRate && !unaired;

  return (
    <div className="group relative w-66 shrink-0">
      <div className="relative aspect-video overflow-hidden rounded-card border border-border-subtle transition-transform duration-300 ease-out group-hover:z-10 group-hover:scale-[1.03]">
        {still ? (
          <img src={still} alt={line2} loading="lazy" className="h-full w-full object-cover" />
        ) : !unaired ? (
          /* AIRED, but TMDB has no still for it yet. TMDB uploads episode stills LATE (fans post
             them hours/days after air), and our caches (1 h server + client) hold that null a while
             longer — so a "No image" box was appearing for episodes whose photo does exist, just not
             yet in the snapshot we cached. Rather than that bug-looking box, the card borrows the
             SHOW's backdrop, lightly treated. LIGHT blur (not the heavy 5px of an unaired card) and
             NO clock: this HAS aired, the photo is merely missing, and it swaps to the real still on
             the next load once TMDB (and the cache) catch up. */
          <>
            {backdrop ? (
              <img
                src={backdrop}
                alt=""
                aria-hidden
                loading="lazy"
                className="absolute inset-0 h-full w-full scale-105 object-cover opacity-80 blur-[2px] saturate-75"
              />
            ) : (
              <div className="absolute inset-0 bg-surface-2" />
            )}
            <div className="absolute inset-0 bg-linear-to-t from-black/55 via-black/15 to-black/25" />
            <div className="absolute inset-0 flex items-center justify-center">
              <ImageOff size={18} className="text-white/45 filter-[drop-shadow(0_1px_2px_rgba(0,0,0,0.7))]" />
            </div>
          </>
        ) : (
          <div className="h-full w-full bg-surface-2" />
        )}

        {/* NOT OUT YET. There is no still, because there is no episode — and "No image" reads as a
            bug when it's actually information. So the card borrows the SHOW's backdrop, blurred and
            desaturated: it plainly belongs to this series, and it is just as plainly NOT a
            photograph of the episode. An episode still is sharp; this can't be mistaken for one.
            The blur says "not here yet" without a word. */}
        {unaired && (
          <>
            {backdrop && (
              <img
                src={backdrop}
                alt=""
                aria-hidden
                loading="lazy"
                // Blurred, desaturated — but still READABLE as the show. Fully grayscaling a dark
                // backdrop behind a 65% mask left a black rectangle: technically a placeholder,
                // visually nothing. Keep some colour and some light; the blur alone already says
                // "this isn't a photograph of the episode".
                className="absolute inset-0 h-full w-full scale-110 object-cover opacity-90 blur-[5px] saturate-50"
              />
            )}
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1 bg-black/45 px-2 text-center [text-shadow:0_1px_4px_rgba(0,0,0,0.8)]">
              <Clock size={14} className="text-white/70" />
              {unairedOn ? (
                <>
                  <span className="text-micro font-semibold text-white/90">{airLabel(unairedOn).lead}</span>
                  {airLabel(unairedOn).sub && (
                    <span className="text-[11px] text-white/45">{airLabel(unairedOn).sub}</span>
                  )}
                </>
              ) : (
                <span className="text-micro font-semibold text-white/85">Not scheduled</span>
              )}
            </div>
          </>
        )}

        {/* Bottom-right — rating DISPLAY only (teal ★ + value), not interactive */}
        {hasActions && rated && (
          <div className="pointer-events-none absolute bottom-2 right-2 z-10">
            <span className="on-artwork flex h-6 items-center gap-1 rounded-full px-1.5">
              <Star size={11} style={{ color: RATE_COLOR, fill: RATE_COLOR }} />
              <span className="text-micro font-semibold tabular-nums" style={{ color: RATE_COLOR }}>{rating}</span>
            </span>
          </div>
        )}
      </div>

      {/* Top-right — best-ep indicator (gold star) + "…" menu. OUTSIDE the scaling frame on
          purpose: the poster/backdrop zooms on hover, the menu does NOT — the trigger stays put so
          the Radix popover anchored to it never drifts, matching every other card's menu. */}
      {hasActions && (
        <div className="absolute right-2 top-2 z-20 flex items-center gap-1.5">
          {highlighted && (
            <Hint label="Best episode">
              <span className="on-artwork flex h-7 w-7 items-center justify-center rounded-full">
                <Star size={13} style={{ color: HIGHLIGHT, fill: HIGHLIGHT }} />
              </span>
            </Hint>
          )}
          <Popover open={menuOpen} onOpenChange={setMenuOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={cn(
                  "on-artwork flex h-7 w-7 items-center justify-center rounded-full text-white/85 transition-all hover:text-white",
                  // Touch has no hover: below sm the control is always there; on desktop it reveals
                  // on hover (or when the menu / best-ep star is active).
                  highlighted
                    ? "opacity-100"
                    : "opacity-100 can-hover:opacity-0 can-hover:group-hover:opacity-100 can-hover:data-[state=open]:opacity-100",
                )}
              >
                <MoreVertical size={14} />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-52 overflow-hidden rounded-card border-border-default bg-surface-3 p-0 shadow-md">
              {/* Best episode — one clean row. Same row grammar as the poster "…" menu:
                  px-3 py-2, text-xs, gap-2.5, hover:bg-surface-2, 13px icon. */}
              <button
                type="button"
                onClick={onToggle}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-xs text-text-secondary transition-colors hover:bg-surface-2 hover:text-text-primary"
              >
                <Star size={13} style={{ color: HIGHLIGHT, fill: HIGHLIGHT }} />
                {highlighted ? "Remove from best episode" : "Mark as best episode"}
              </button>

              <div className="my-1 h-px bg-border-default" />

              {/* Rating — the same value Select as Watch History, not a slider. "—" clears it,
                  so no separate Clear button. */}
              <div className="px-3 pb-3 pt-2">
                <p className="mb-1.5 flex items-center gap-1.5 text-caption font-semibold uppercase tracking-wide text-text-tertiary">
                  <Star size={13} style={{ color: RATE_COLOR, fill: RATE_COLOR }} />
                  Your rating
                </p>
                <Select
                  value={rated ? String(rating) : undefined}
                  onValueChange={(v) => onRate(v === "none" ? null : Number(v))}
                >
                  <SelectTrigger variant="legacy" className="h-8 w-full border-border-subtle bg-surface-1 text-xs text-accent-watching-vivid focus:ring-0">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent variant="legacy" className="border-border-strong bg-surface-3">
                    <SelectItem value="none" className="text-xs focus:bg-surface-2 focus:text-text-primary">—</SelectItem>
                    {[10, 9.5, 9, 8.5, 8, 7.5, 7, 6.5, 6, 5.5, 5].map((n) => (
                      <SelectItem key={n} value={String(n)} className="text-xs focus:bg-surface-2 focus:text-text-primary">{n}/10</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      )}

      {/* Number · title · overview.
          The number is an EYEBROW: it belongs to the title, so it sits closer to it (2px) than the
          overview does (4px) — that difference is what says "these two are one thing, this is
          another". Equal spacing everywhere would read as four unrelated lines. At zero, though,
          the two tight line-heights (1.35 and 1.3) made them touch. */}
      <div className="mt-2">
        <p className="mb-0.5 text-micro font-medium text-text-tertiary">{line1}</p>
        <p className="truncate text-xs font-semibold text-text-primary">{line2}</p>
        {overview && (
          <p className="mt-1 line-clamp-2 text-micro leading-relaxed text-text-tertiary">{overview}</p>
        )}
      </div>
    </div>
  );
}

export function Episodes({ media, currentSeason, readOnly = false, cours }: { media: WatchingMedia; currentSeason?: number; readOnly?: boolean; cours?: AnimeCour[] }) {
  // Anime v2: seasons are AniList cours. TMDB has one flat season, so we always FETCH season 1 and
  // slice it by the selected cour's flat episode range. Marks stay in TMDB coordinates (season 1 +
  // the flat episode number); only the displayed episode number is per-cour.
  const overlayOn = !!cours && cours.length > 0;
  // The overlay branch already answers this from the cours; the raw read is the OTHER branch — a
  // title with no overlay, whose TMDB seasons are exactly what it displays. This component takes
  // `cours` rather than a MediaView because it also serves the discover page, where there is no row
  // to build a lens from.
  // eslint-disable-next-line no-restricted-syntax -- no-overlay branch, where TMDB seasons are the display seasons.
  const seasonCount = overlayOn ? cours!.length : (media.season_episodes?.length ?? media.seasons ?? 1);
  const [view, setView] = useState<View>("all");
  const [season, setSeason] = useState(
    currentSeason && currentSeason <= seasonCount ? currentSeason : 1,
  );
  const [heatmapOpen, setHeatmapOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Switching season starts the row from the beginning, not wherever you'd scrolled.
  useEffect(() => {
    scrollRef.current?.scrollTo({ left: 0 });
  }, [season, view]);

  const { data: episodesRaw = [], isLoading } = useSeasonEpisodes(
    media.tmdb_id ?? 0,
    overlayOn ? 1 : season,   // overlay → always TMDB season 1, then slice by cour below
    !!media.tmdb_id && view === "all",
  );
  // The selected cour, and the episodes that fall in its flat range. `markSeason` is the coordinate
  // marks/ratings are stored under: TMDB season 1 for an overlay anime, else the picked season.
  const cour = overlayOn ? (cours!.find((c) => c.season === season) ?? cours![0]) : null;
  const episodes = cour
    ? episodesRaw.filter((e) => e.number >= cour.start_episode && (cour.end_episode == null || e.number <= cour.end_episode))
    : episodesRaw;
  const markSeason = overlayOn ? 1 : season;
  const { data: marks = [] } = useEpisodeHighlights(media.id);
  const addHighlight = useAddEpisodeHighlight(media.id);
  const removeHighlight = useRemoveEpisodeHighlight(media.id);
  const setRating = useSetEpisodeRating(media.id);

  /**
   * STOP READING A CLAIM YOU AREN'T MAKING.
   *
   * Closing the actions was only half the job. The marks themselves were still read: the
   * Highlights tab listed every starred episode of every season — including seasons you have
   * never reached — counted them in its badge, and let you edit them there, because that rail
   * never asked the question the All rail now asks. True Detective is an anthology: you watched
   * season 1, and season 4's starred episode sat in your highlights with its gold star on.
   *
   * Nothing is deleted. Your star is a true fact the day you get there, and it comes back by
   * itself when you do — the same rule as `reachedEntries` for season years, applied to episodes.
   */
  const claimable = useMemo(
    () => marks.filter((h) => isEpisodeActionable(media, h.season, h.episode)),
    [marks, media],
  );
  const highlightRows = useMemo(() => claimable.filter((h) => h.highlighted), [claimable]);
  const highlightMap = useMemo(
    () => new Map(highlightRows.map((h) => [`${h.season}-${h.episode}`, h.id])),
    [highlightRows],
  );
  const ratingMap = useMemo(
    () => new Map(claimable.filter((h) => h.rating != null).map((h) => [`${h.season}-${h.episode}`, h.rating as number])),
    [claimable],
  );

  const handleRate = async (
    s: number,
    e: number,
    meta: { title: string | null; still_path: string | null },
    rating: number | null,
  ) => {
    try {
      await setRating.mutateAsync({
        userId: media.user_id,
        orgId: media.org_id,
        season: s,
        episode: e,
        rating,
        title: meta.title,
        still_path: meta.still_path,
      });
    } catch (err) {
      if (isDemoReadOnlyError(err)) return;
      toast.error("Failed to save rating.");
    }
  };

  const toggleHighlight = async (s: number, e: number) => {
    const existingId = highlightMap.get(`${s}-${e}`);
    if (!existingId && highlightRows.length >= MAX_HIGHLIGHTS) {
      toast.error(`You can pin up to ${MAX_HIGHLIGHTS} best episodes.`);
      return;
    }
    try {
      if (existingId) {
        await removeHighlight.mutateAsync(existingId);
      } else {
        await addHighlight.mutateAsync({
          tmdbId: media.tmdb_id!,
          userId: media.user_id,
          orgId: media.org_id,
          season: s,
          episode: e,
        });
      }
    } catch (err) {
      if (isDemoReadOnlyError(err)) return;
      toast.error(err instanceof Error ? err.message : "Failed to update.");
    }
  };

  if (!media.tmdb_id || seasonCount < 1) return null;

  const scroll = (dir: number) => scrollRef.current?.scrollBy({ left: dir * 560, behavior: "smooth" });
  // Keep the header's scroll arrows STABLE while a season loads. Mid-fetch `episodes` is [], which
  // flipped the arrows off and then on again on every season switch — and since the arrows (h-8)
  // are the tallest thing in the header, that toggle changed the header's height (and could trip
  // `flex-wrap`), shoving the whole section up then down. The skeleton always shows 5 cards, so a
  // loading rail always scrolls: hold the arrows on until the real count says otherwise.
  const showChevrons = view === "all" ? (isLoading || episodes.length > 3) : highlightRows.length > 3;

  // A scrolling rail — no panel. (See CastCrew: a frame its own content escapes reads as a bug.)
  return (
    <section>
      <SectionHeader
        title="Episodes"
        actions={
          <>
            {/* No All/Highlights toggle when read-only — there are no highlights on an unwatched title */}
            {!readOnly && (
              <SegmentedControl<View>
                size="sm"
                value={view}
                onChange={setView}
                items={[
                  { value: "all", label: "All" },
                  { value: "highlights", label: highlightRows.length ? `Highlights ${highlightRows.length}` : "Highlights" },
                ]}
              />
            )}
            {showChevrons && <CarouselNav size="md" onPrev={() => scroll(-1)} onNext={() => scroll(1)} />}
            {HEATMAP_ENABLED && (
              <Button variant="quiet" size="sm" onClick={() => setHeatmapOpen(true)}>
                <BarChart3 />
                Ratings
              </Button>
            )}
          </>
        }
      />

      {/* Season selector — All view only. Chips up to 10; beyond that (One Piece: 23)
          a wall of chips is unusable → collapse into a Select. */}
      {view === "all" && seasonCount > 1 && (
        seasonCount > 10 ? (
          <div className="mb-3">
            <FilterSelect
              size="sm"
              className="w-40"
              value={String(season)}
              onChange={(v) => setSeason(Number(v))}
              options={Array.from({ length: seasonCount }, (_, i) => ({
                value: String(i + 1),
                label: `Season ${i + 1}`,
              }))}
              aria-label="Season"
            />
          </div>
        ) : (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {Array.from({ length: seasonCount }, (_, i) => i + 1).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSeason(s)}
                className={cn(
                  "rounded-control px-2.5 py-1 text-xs font-medium transition-colors",
                  s === season
                    ? "bg-accent-watching text-white"
                    : "bg-surface-2 text-text-tertiary hover:bg-surface-3 hover:text-text-secondary",
                )}
              >
                S{s}
              </button>
            ))}
          </div>
        )
      )}

      {/* ── All: this season's episodes ── */}
      {view === "all" ? (
        isLoading ? (
          <EpisodeCardsSkeleton />
        ) : episodes.length === 0 ? (
          <p className="py-6 text-center text-xs text-text-tertiary">No episodes found.</p>
        ) : (
          <div ref={scrollRef} className="-mx-4 flex gap-3 overflow-x-auto scroll-px-4 px-4 py-2 scrollbar-hide sm:-mx-1.5 sm:px-1.5 sm:scroll-px-1.5">
            {episodes.map((ep) => {
              // Display number is per-cour (S2 starts at "Episode 1"); the stored coordinate stays
              // the TMDB flat number, so marks and progress never shift under the overlay.
              const dispNum = cour ? ep.number - cour.start_episode + 1 : ep.number;
              return (
              <StillCard
                key={ep.number}
                still={ep.still_url}
                // The full coordinate, IMDb-style, plus WHEN it aired — the eyebrow used to say only
                // "Episode 4", which tells you nothing you can act on. `season` is display space (a
                // cour number under the overlay) and `dispNum` is per-cour, so this reads "S2.E5" on
                // a lumped anime, matching the rest of the app. The date is dropped for an episode
                // that hasn't aired: its still already carries a "coming" card, and a future date in
                // a past-tense eyebrow would read as a fact it isn't yet.
                line1={
                  ep.air_date && !isUnaired(ep.air_date)
                    ? `S${season}.E${dispNum} · ${fmtAir(ep.air_date)}`
                    : `S${season}.E${dispNum}`
                }
                line2={ep.name}
                overview={ep.overview}
                highlighted={highlightMap.has(`${markSeason}-${ep.number}`)}
                rating={ratingMap.get(`${markSeason}-${ep.number}`) ?? null}
                unairedOn={isUnaired(ep.air_date) ? ep.air_date : undefined}
                backdrop={media.backdrop_url}
                onToggle={readOnly ? () => {} : () => toggleHighlight(markSeason, ep.number)}
                // A rating is a VERDICT, not a bookmark. You may score an episode only if it has
                // AIRED *and* you have REACHED it — True Detective's seasons 2-4 are locked in
                // Watch History, yet this rail happily let you star any episode inside them.
                // The title and the still stay visible; only the actions close.
                onRate={readOnly || !isEpisodeActionable(media, markSeason, ep.number)
                  ? undefined
                  : (r) => handleRate(markSeason, ep.number, {
                      title: ep.name,
                      still_path: ep.still_url ? ep.still_url.replace(TMDB_STILL, "") : null,
                    }, r)}
              />
              );
            })}
          </div>
        )
      ) : (
        /* ── Highlights: starred episodes across all seasons ── */
        highlightRows.length === 0 ? (
          <p className="py-6 text-center text-xs text-text-tertiary">
            Star an episode in <span className="text-text-secondary">All</span> to pin your best moments here.
          </p>
        ) : (
          <div ref={scrollRef} className="-mx-4 flex gap-3 overflow-x-auto scroll-px-4 px-4 py-2 scrollbar-hide sm:-mx-1.5 sm:px-1.5 sm:scroll-px-1.5">
            {highlightRows.map((h) => (
              <StillCard
                key={h.id}
                still={h.still_path ? `${TMDB_STILL}${h.still_path}` : null}
                line1={`S${h.season}.E${h.episode}`}
                line2={h.title ?? `Episode ${h.episode}`}
                highlighted
                rating={ratingMap.get(`${h.season}-${h.episode}`) ?? null}
                backdrop={media.backdrop_url}
                onToggle={() => toggleHighlight(h.season, h.episode)}
                onRate={(r) => handleRate(h.season, h.episode, { title: h.title, still_path: h.still_path }, r)}
              />
            ))}
          </div>
        )
      )}

      {HEATMAP_ENABLED && (
        <EpisodeHeatmapModal open={heatmapOpen} onClose={() => setHeatmapOpen(false)} media={media} />
      )}
    </section>
  );
}
