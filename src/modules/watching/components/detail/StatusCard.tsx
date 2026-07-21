"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bookmark, CalendarPlus, Check, ChevronDown, CircleSlash, Clock, Heart,
  Minus, MoreHorizontal, PauseCircle, Pencil, Play, Plus, Repeat, RotateCcw, Trash2, X,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/shared/components/ui/popover";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/shared/components/ui/select";
import { cn } from "@/shared/utils/utils";
import { Hint } from "@/shared/components/ui/tooltip";
import { toast } from "@/shared/utils/toast";
import { isDemoReadOnlyError } from "@/shared/utils/demo-guard";
import { useRewatches, useAddRewatch, useRemoveRewatch } from "../../hooks/useRewatches";
import { dropReasonLabel } from "../../lib/drop-reasons";
import { caughtUpOn, hasFullyWatchedSeason, seriesState } from "../../lib/series-state";
import type { MediaView } from "../../lib/media-view";
import { canComplete, deriveWatchStatus } from "../../lib/watch-status";
import { WatchDatePicker } from "../shared/WatchDatePicker";
import { WhereToWatch } from "../shared/WhereToWatch";
import { partsFromISO, type WatchDateParts } from "../../lib/watched-date";
import type { WatchingMedia, WatchStatus } from "../../types";
import type { WatchProviderInfo } from "../../hooks/useWatchProviders";

// Design-system §9.1 — physical, not linear.
const SPRING_SMOOTH = { type: "spring", stiffness: 300, damping: 28 } as const;
const SPRING_SNAPPY = { type: "spring", stiffness: 400, damping: 30 } as const;

const TEAL = "var(--color-accent-watching-vivid)";

type CardStatus = "want_to_watch" | "in_progress" | "watched" | "paused" | "dropped";

/**
 * This card used to derive the status itself, under a comment claiming it "mirrored"
 * deriveWatchStatus. It did not: it read `watched` BEFORE the stances, where the service reads it
 * after. So a row carrying both flags said "Watched" here and "Dropped" in a list — two rules, two
 * truths, one screen, on the module's most central word. There is one rule now, and this maps it
 * onto the five chips the card can draw.
 */
const CARD_STATUS: Record<WatchStatus, CardStatus> = {
  reference: "want_to_watch",
  plan_to_watch: "want_to_watch",
  dropped: "dropped",
  paused: "paused",
  completed: "watched",
  watching: "in_progress",
};

// "Watched" label: films → the watched_at year; series → the season-year range.
// The year map comes from the LENS, never from the row: on an overlaid anime the years live in
// `cour_years` and `season_years` is empty, so reading the column made Blue Lock — dated 2023 and
// 2024 by hand — fall back to its `watched_at` year instead of showing the span.
function watchedLabel(media: WatchingMedia, yearMap: Record<string, number> | null | undefined): string | null {
  if (media.type === "film") {
    return media.watched_at ? String(new Date(media.watched_at).getFullYear()) : null;
  }
  const years = Object.values(yearMap ?? {}).map(Number).filter((y) => !Number.isNaN(y));
  if (!years.length) return media.watched_at ? String(new Date(media.watched_at).getFullYear()) : null;
  const min = Math.min(...years), max = Math.max(...years);
  return min === max ? String(min) : `${min} – ${max}`;
}

function watchedYearOf(media: WatchingMedia, yearMap: Record<string, number> | null | undefined): number | null {
  if (media.type === "film") return media.watched_at ? new Date(media.watched_at).getFullYear() : null;
  return yearMap?.["1"] ?? null;
}

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-GB", { month: "short", year: "numeric" });
const todayISO = () => new Date().toISOString().slice(0, 10);

// ── Card atoms (white-on-teal language, ex-My Record skin) ─────────────────────

function StateChip({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 rounded-full bg-white/12 px-2.5 py-1 text-label font-medium text-white">
      {icon}
      <span className="truncate">{children}</span>
    </span>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className="shrink-0 text-label text-white/45">{label}</span>
      <span className="min-w-0 text-right text-label font-medium text-white">{value}</span>
    </div>
  );
}

/**
 * `total` and `max` are NOT the same number, and conflating them was a real bug.
 *   total → what the season IS. It INFORMS. (House of the Dragon season 3 has 8 episodes.)
 *   max   → what has AIRED. It DECIDES. (Four of them exist. You may not claim the other four.)
 * Showing "4 / 4" enforced the ceiling by DELETING the information — a season one-third watched
 * looked complete, and you lost the one thing you wanted to know: how much is still coming.
 * The rule was only ever about actions: the ANNOUNCED may be displayed, the AIRED decides.
 */
function StepRow({ label, value, total, max, min = 0, onDelta }: {
  label: string; value: number; total: number | null; max?: number | null; min?: number; onDelta: (d: number) => void;
}) {
  const ceiling = max ?? total;
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-label text-white/45">{label}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onDelta(-1)}
          disabled={value <= min}
          className="flex h-6 w-6 items-center justify-center rounded-control bg-white/10 text-white/75 transition-colors hover:bg-white/15 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
        >
          <Minus size={11} />
        </button>
        {/* NOT cn(): tailwind-merge treats the custom `text-label` size token as a
            text COLOR and lets `text-white` strip it → the digits blow up to 16px. */}
        <span className={`text-center text-label font-semibold tabular-nums text-white ${total != null ? "min-w-12" : "min-w-6"}`}>
          {total != null ? `${value} / ${total}` : value}
        </span>
        <button
          type="button"
          onClick={() => onDelta(1)}
          disabled={ceiling != null && value >= ceiling}
          className="flex h-6 w-6 items-center justify-center rounded-control bg-white/10 text-white/75 transition-colors hover:bg-white/15 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
        >
          <Plus size={11} />
        </button>
      </div>
    </div>
  );
}

function PrimaryAction({ icon, children, onClick, disabled }: {
  icon: React.ReactNode; children: React.ReactNode; onClick?: () => void; disabled?: boolean;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      whileTap={{ scale: 0.98 }}
      transition={SPRING_SNAPPY}
      className="flex h-8 w-full items-center justify-center gap-1.5 rounded-control bg-white text-label font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
    >
      {icon}
      {children}
    </motion.button>
  );
}

const menuItemClass = "gap-2.5 px-3 py-2 text-xs text-text-secondary focus:bg-surface-2 focus:text-text-primary";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const range = (from: number, to: number) =>
  from > to ? [] : Array.from({ length: to - from + 1 }, (_, i) => from + i);

// Log a past rewatch, constrained to [release, today] — you can't have rewatched a
// title before it existed. Month precision is enough (Year → Month, month narrows to
// the release/now bounds), so everything fits on one row.
function RewatchDatePicker({ releaseISO, onAdd, onCancel, pending }: {
  releaseISO: string | null;
  onAdd: (iso: string) => void;
  onCancel: () => void;
  pending: boolean;
}) {
  const now = new Date();
  const rel = releaseISO ? new Date(releaseISO) : null;
  const valid = rel && !Number.isNaN(rel.getTime());
  const relY = valid ? rel!.getFullYear() : null;
  const relM = valid ? rel!.getMonth() + 1 : null;

  const [y, setY] = useState<number | null>(null);
  const [m, setM] = useState<number | null>(null);

  const years = range(relY ?? 1950, now.getFullYear()).reverse();
  const monthMin = y != null && y === relY ? relM! : 1;
  const monthMax = y === now.getFullYear() ? now.getMonth() + 1 : 12;
  const months = range(monthMin, monthMax);

  const complete = y != null && m != null;
  const submit = () => { if (complete) onAdd(`${y}-${String(m).padStart(2, "0")}-01`); };

  const triggerCls = "h-8 flex-1 border-0 bg-white/10 text-white/90 focus:ring-0 data-[placeholder]:text-white/45";
  const contentCls = "border-border-strong bg-surface-3";
  const itemCls = "text-xs focus:bg-surface-2 focus:text-text-primary";

  return (
    <div className="mt-2 flex items-center gap-1.5">
      <Select value={y != null ? String(y) : undefined} onValueChange={(v) => { setY(Number(v)); setM(null); }}>
        <SelectTrigger variant="legacy" className={triggerCls}><SelectValue placeholder="Year" /></SelectTrigger>
        <SelectContent variant="legacy" className={contentCls}>
          {years.map((yr) => <SelectItem key={yr} value={String(yr)} className={itemCls}>{yr}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={m != null ? String(m) : undefined} onValueChange={(v) => setM(Number(v))} disabled={y == null}>
        <SelectTrigger variant="legacy" className={triggerCls}><SelectValue placeholder="Month" /></SelectTrigger>
        <SelectContent variant="legacy" className={contentCls}>
          {months.map((mm) => <SelectItem key={mm} value={String(mm)} className={itemCls}>{MONTHS[mm - 1]}</SelectItem>)}
        </SelectContent>
      </Select>
      <Hint label="Add rewatch">
        <button
          type="button"
          onClick={submit}
          disabled={!complete || pending}
          aria-label="Add rewatch"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control bg-white/15 text-white transition-colors hover:bg-white/20 disabled:opacity-40"
        >
          <Check size={14} />
        </button>
      </Hint>
      <Hint label="Cancel">
        <button
          type="button"
          onClick={onCancel}
          aria-label="Cancel"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control text-white/60 transition-colors hover:text-white"
        >
          <X size={14} />
        </button>
      </Hint>
    </div>
  );
}

// ── StatusCard ──────────────────────────────────────────────────────────────────
// THE state-aware surface of the detail page — the module's branded hero card,
// first in the right rail (desktop) / right under the hero (mobile). One home for
// "what do I do with this title": state chip + the state's facts + its one action.
// Density adapts vertically — no state leaves the card empty.

interface Props {
  media: WatchingMedia;
  isSeries: boolean;
  providers?: WatchProviderInfo | null;
  currentSeason: number;
  currentEpisode: number;
  onUpdateProgress: (season: number, episode: number) => void;
  favorite: boolean;
  onFavoriteToggle: () => void;
  onMarkWatched: () => void;
  onMarkCaughtUp: () => void;                // series still running → the honest version of "watched"
  onStartWatching: () => void;
  onPause: () => void;
  onDrop: () => void;                        // opens the drop-reason CaptureSheet
  onResume: () => void;
  onAddNote: () => void;                     // want_to_watch → reveals the My Take editor
  onWatchedYearChange: (year: number) => void;      // one-season series → season_years["1"]
  onWatchedDateChange: (parts: WatchDateParts) => void;   // film → precise watched_at
  onDelete: () => void;                      // opens the shared delete-confirm modal
  isUpdating?: boolean;
  /**
   * THE LENS. `currentSeason`/`currentEpisode` arrive in DISPLAY space, and every season number this
   * card shows or bounds comes from `view.seasons` — so a lumped anime reads "Season 2 · Episode 1"
   * like the rest of the app instead of the flat "Episode 25 / 38" it used to print next to a Watch
   * History cut into cours. `hideSeasonStepper` existed ONLY because this card could not see the
   * overlay; with the lens the season stepper is meaningful again, so the patch is gone.
   */
  view?: MediaView | null;
}

export function StatusCard({
  media, isSeries, providers, currentSeason, currentEpisode, onUpdateProgress, view,
  favorite, onFavoriteToggle, onMarkWatched, onMarkCaughtUp, onStartWatching, onPause, onDrop,
  onResume, onAddNote, onWatchedYearChange, onWatchedDateChange, onDelete, isUpdating,
}: Props) {
  const status: CardStatus = CARD_STATUS[deriveWatchStatus(media)];

  // "Mark as completed" used to appear when you reached the last ANNOUNCED episode — which for
  // an ongoing show meant the app cheerfully offered to declare a story finished that isn't.
  // The state is now derived from what has actually AIRED plus whether the show is over:
  //   · completed → the show is over and you've seen it all. Only then may you complete it.
  //   · caught-up → you've seen everything that exists, but it isn't over. You're WAITING, and
  //     the card says so instead of pretending you have a decision to make.
  // The live position (the stepper) wins over the stored row, so the state follows your taps.
  // The seasons, in the space this card speaks. Falls back to the raw row when there is no lens, so
  // a plain series behaves exactly as before.
  // eslint-disable-next-line no-restricted-syntax -- the no-lens fallback: for a plain series the raw seasons ARE the display space.
  const seasons = view?.seasons ?? (media.season_episodes ?? []).map((episodes, i) => ({
    season: i + 1,
    episodes: episodes ?? 0,
    // eslint-disable-next-line no-restricted-syntax -- same fallback, aired counts for the same plain-series branch.
    aired: (media.season_aired ?? [])[i] ?? 0,
    poster: null as string | null,
    endDate: null as string | null,
  }));
  const here = seasons[currentSeason - 1];

  const seriesFacts = {
    ...(view ? view.seriesFacts : media),
    watched: media.watched,
    current_season: currentSeason,
    current_episode: currentEpisode,
  };
  const state = isSeries ? seriesState(seriesFacts) : null;
  const atLastEpisode = state === "completed";
  const caughtUp = state === "caught-up";

  /**
   * REWATCHING WAS TIED TO THE WRONG WORD.
   *
   * "Log rewatch" lived on `watched`, and only there — so The Last of Us, which you have seen
   * every episode of and are waiting on, could not be rewatched. Not because rewatching it is
   * meaningless (you did it last month), but because the app had filed it under "in progress" and
   * that shelf has no such button. The condition was never `watched`; it was HAVE YOU SEEN IT
   * ALL. Completed and caught-up both answer yes.
   */
  const canRewatch = isSeries ? atLastEpisode || caughtUp : media.watched;

  const { data: rewatches = [] } = useRewatches(canRewatch ? media.id : "");
  const addRewatch = useAddRewatch(media.id);
  const removeRewatch = useRemoveRewatch(media.id);
  const [backdating, setBackdating] = useState(false);

  // A rewatch can't predate the title's release — constrains the date picker.
  // Series carry a full S1 air date; films only a year → floor to Jan 1.
  const releaseISO = media.season_air_dates?.[0] || (media.year ? `${media.year}-01-01` : null);

  // THE STEPPERS SHOW THE ANNOUNCED AND STOP AT THE AIRED. Two numbers, two jobs — see StepRow.
  // "4 / 8" with a dead "+" tells you both truths at once: the season has eight episodes, and
  // only four of them exist. "4 / 4" told you neither.
  const announcedSeasons = isSeries ? (seasons.length || media.seasons || null) : null;
  const announcedInSeason = isSeries ? (here?.episodes ?? null) : null;
  // The last season that has aired anything — the ceiling the season stepper may never pass.
  const lastSeasonOut = isSeries
    ? (seasons.reduce((last, s, i) => (s.aired > 0 ? i + 1 : last), 1))
    : null;
  const airedInThisSeason = isSeries ? (here?.aired ?? 0) : null;

  const reason = dropReasonLabel(media.drop_reason);
  // ONE truth for "can this honestly be called watched": a series that is over, or a film that has
  // been released. Drives both the "…" menu item below and the want-to-watch primary action — this
  // card used to keep its own `!isSeries || isFinished` copy, which called every film completable
  // and let you mark an unreleased one as watched.
  const completable = canComplete(media);
  const releaseKnown = isSeries || completable;

  // "Season 3" when you finished it, "S3 · E4" when you walked out mid-season. Both are true
  // sentences; which one applies is a fact about your position, not a formatting choice.
  const stoppedAfter = !isSeries
    ? null
    : hasFullyWatchedSeason(seriesFacts, currentSeason)
      ? `Season ${currentSeason}`
      : currentEpisode > 0
        ? `S${currentSeason} · E${currentEpisode}`
        : null;

  /**
   * THE SIDE DOOR.
   *
   * The front door was locked — "Mark as completed" only appears when the show is really over —
   * and then this menu offered "Mark as watched" from FOUR different states, on any show, running
   * or not. One tap, and you'd declared House of the Dragon finished. That's the third time this
   * exact shape of bug has appeared: bolt the main entrance, leave the service door swinging.
   *
   * What you CAN truthfully say about a show that isn't over is "I've seen everything that's out".
   * So on a running series that's what the item says — and it does the honest thing: it puts your
   * position at the last AIRED episode instead of writing `watched = true` over a blank position.
   */
  const markItem = completable ? (
    <DropdownMenuItem onClick={onMarkWatched} className={menuItemClass}>
      <Check size={13} /> Mark as watched
    </DropdownMenuItem>
  ) : (
    // NOT "Mark as caught up". Being caught up is a state the app DERIVES from two numbers; you do
    // not raise it like a flag, and offering to would re-teach the exact confusion that made
    // `watched` a lie. What the action really does is claim a POSITION — the last episode that
    // exists — so it says that instead, as a sentence about you.
    <DropdownMenuItem onClick={onMarkCaughtUp} className={menuItemClass}>
      <Clock size={13} /> Seen everything that&apos;s out
    </DropdownMenuItem>
  );

  // Year is editable where no Watch History strip owns it: films + 1-season shows.
  // ⚠️ COUNTED IN STORAGE SPACE ON PURPOSE. The question is "does the Watch History strip exist?",
  // and the strip appears for a title with more than one DISPLAY season — but a lumped anime has
  // exactly one TMDB season while displaying several cours, so counting the lens here would hand
  // the year editor to a title whose strip already owns it. The raw count is the honest test.
  // eslint-disable-next-line no-restricted-syntax -- deliberately storage-space: asks how TMDB splits the title, not how we display it.
  const seasonCount = media.season_episodes?.length ?? 0;
  const yearEditable = media.type === "film" ? media.watched : media.watched && seasonCount <= 1;
  // eslint-disable-next-line no-restricted-syntax -- explicit `view ? lens : raw` fallback for the label.
  const yearLabel = watchedLabel(media, view ? view.yearMap : media.season_years);
  // eslint-disable-next-line no-restricted-syntax -- same fallback for the selected value.
  const selectedYear = watchedYearOf(media, view ? view.yearMap : media.season_years);
  const currentYear = new Date().getFullYear();
  const years: number[] = [];
  for (let y = currentYear; y >= Math.min(media.year ?? 1950, currentYear); y--) years.push(y);

  const logRewatch = async (on: string) => {
    if (!on) return;
    try {
      await addRewatch.mutateAsync(on);
      setBackdating(false);
      toast("Rewatch logged.");
    } catch (err) {
      if (isDemoReadOnlyError(err)) return;
      toast.error("Failed to log rewatch.");
    }
  };

  const handleRemoveRewatch = async (id: string) => {
    try {
      await removeRewatch.mutateAsync(id);
    } catch (err) {
      if (isDemoReadOnlyError(err)) return;
      toast.error("Failed to remove.");
    }
  };

  const lastRewatch = rewatches[0]?.watched_on ?? null;

  // The rewatch record — the same instrument wherever you've seen the whole thing, finished or
  // merely caught up. It used to be welded into the `watched` body, which is precisely why a
  // caught-up show couldn't have one.
  const rewatchRows = (
    <>
      {rewatches.length > 0 && (
        <>
          <div className="h-px bg-white/10" />
          <Row
            label="Rewatches"
            value={
              /* The dates live one tap away — a quiet list, removable per entry */
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="group inline-flex items-center gap-1 text-label font-medium text-white transition-colors hover:text-white/90"
                  >
                    {rewatches.length === 1 && lastRewatch
                      ? fmtDate(lastRewatch)
                      : `${rewatches.length} times`}
                    <ChevronDown size={11} className="text-white/40 transition-colors group-hover:text-white/70" />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-52 border-border-strong bg-surface-3 p-1.5">
                  {rewatches.map((r) => (
                    <div
                      key={r.id}
                      className="group flex items-center justify-between gap-2 rounded-chip px-2 py-1.5 transition-colors hover:bg-surface-2"
                    >
                      <span className="inline-flex items-center gap-2 text-xs text-text-secondary">
                        <Repeat size={11} className="text-accent-watching-vivid" />
                        {fmtDate(r.watched_on)}
                      </span>
                      <Hint label="Remove this rewatch">
                        <button
                          type="button"
                          aria-label="Remove this rewatch"
                          onClick={() => handleRemoveRewatch(r.id)}
                          className="flex h-5 w-5 items-center justify-center rounded text-text-tertiary opacity-0 transition-[opacity,color] hover:text-red-400 group-hover:opacity-100"
                        >
                          <X size={11} />
                        </button>
                      </Hint>
                    </div>
                  ))}
                </PopoverContent>
              </Popover>
            }
          />
        </>
      )}

      {backdating && (
        <RewatchDatePicker
          releaseISO={releaseISO}
          pending={addRewatch.isPending}
          onAdd={(iso) => logRewatch(iso)}
          onCancel={() => setBackdating(false)}
        />
      )}
    </>
  );

  return (
    <section
      data-status-card
      className="rounded-card bg-accent-watching p-4"
      style={{
        boxShadow:
          "inset 0 1px 0 0 rgba(255,255,255,0.10), inset 0 0 0 1px rgba(255,255,255,0.06), 0 2px 6px -2px rgba(0,0,0,0.5), 0 18px 44px -18px rgba(0,0,0,0.6)",
      }}
    >
      {/* ── Header: state identity + secondary actions ── */}
      <div className="flex items-center justify-between gap-2">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={`chip-${status}-${caughtUp}`}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={SPRING_SMOOTH}
            className="min-w-0"
          >
            {status === "want_to_watch" && (
              <StateChip icon={<Bookmark size={11} />}>
                {media.is_reference ? "Unwatched" : "Want to Watch"}
              </StateChip>
            )}
            {/* CAUGHT UP IS NOT "IN PROGRESS", AND THE CHIP SHOULD NOT SAY SO.
                A series you have seen every existing episode of is not something you are in the
                middle of — it is finished, for now. The card knew this and said it in a pill at the
                bottom, while the chip at the top went on contradicting it. An app that files a
                state under the name of another state is the disease this whole module has been
                treated for; the last place it survived was the label. */}
            {status === "in_progress" && caughtUp && (
              <StateChip icon={<Clock size={11} />}>Caught Up</StateChip>
            )}
            {status === "in_progress" && !caughtUp && (
              <StateChip icon={<span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: TEAL, boxShadow: `0 0 6px ${TEAL}` }} />}>
                In Progress
              </StateChip>
            )}
            {status === "watched" && <StateChip icon={<Check size={11} />}>Watched</StateChip>}
            {status === "paused" && <StateChip icon={<PauseCircle size={11} />}>Paused</StateChip>}
            {status === "dropped" && <StateChip icon={<CircleSlash size={11} />}>Dropped</StateChip>}
          </motion.div>
        </AnimatePresence>

        <div className="flex shrink-0 items-center gap-1.5">
          {status !== "want_to_watch" && (
            <button
              type="button"
              aria-label={favorite ? "Remove from favorites" : "Add to favorites"}
              title={favorite ? "Remove from favorites" : "Add to favorites"}
              onClick={onFavoriteToggle}
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-control transition-colors active:scale-95",
                favorite ? "bg-white/15 text-white" : "bg-white/10 text-white/70 hover:bg-white/15 hover:text-white",
              )}
            >
              <Heart size={13} className={cn(favorite && "fill-red-500 text-red-500")} />
            </button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="More actions"
                className="flex h-7 w-7 items-center justify-center rounded-control bg-white/10 text-white/70 transition-colors hover:bg-white/15 hover:text-white data-[state=open]:bg-white/15 data-[state=open]:text-white"
              >
                <MoreHorizontal size={14} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 rounded-card border-border-default bg-surface-3 p-1 shadow-md">
              {status === "want_to_watch" && (
                <>
                  {isSeries && markItem}
                  <DropdownMenuItem onClick={onAddNote} className={menuItemClass}>
                    <Pencil size={13} /> Add a note
                  </DropdownMenuItem>
                </>
              )}
              {status === "in_progress" && (
                <>
                  <DropdownMenuItem onClick={onPause} className={menuItemClass}>
                    <PauseCircle size={13} /> Pause
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onDrop} className={menuItemClass}>
                    <CircleSlash size={13} /> Drop
                  </DropdownMenuItem>
                  {/* Hidden when you're already standing at the frontier — the card says
                      "All caught up" two inches below, and a menu item offering to do it again
                      is noise pretending to be an action. */}
                  {!caughtUp && markItem}
                  {/* Caught up = you've seen every episode that exists. Watching it again is a
                      thing people do (The Last of Us, while waiting) and the app simply had no
                      door for it — "Log rewatch" was welded to the word `watched`. The primary
                      slot is taken by the "All caught up" line, which is the more important
                      truth, so both rewatch actions live here. */}
                  {caughtUp && (
                    <>
                      <DropdownMenuItem onClick={() => logRewatch(todayISO())} className={menuItemClass}>
                        <Repeat size={13} /> Log rewatch
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setBackdating((v) => !v)} className={menuItemClass}>
                        <CalendarPlus size={13} /> Log a past rewatch
                      </DropdownMenuItem>
                    </>
                  )}
                </>
              )}
              {status === "paused" && (
                <>
                  <DropdownMenuItem onClick={onDrop} className={menuItemClass}>
                    <CircleSlash size={13} /> Drop
                  </DropdownMenuItem>
                  {markItem}
                </>
              )}
              {status === "dropped" && (
                <>
                  {markItem}
                  <DropdownMenuItem onClick={onDrop} className={menuItemClass}>
                    <Pencil size={13} /> Change reason
                  </DropdownMenuItem>
                </>
              )}
              {status === "watched" && (
                <DropdownMenuItem onClick={() => setBackdating((v) => !v)} className={menuItemClass}>
                  <CalendarPlus size={13} /> Log a past rewatch
                </DropdownMenuItem>
              )}

              <DropdownMenuSeparator className="bg-border-default" />
              <DropdownMenuItem
                onClick={onDelete}
                className="gap-2.5 px-3 py-2 text-xs text-red-400 focus:bg-red-500/10 focus:text-red-400"
              >
                <Trash2 size={13} /> Delete from library
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* ── Body: the state's facts ── */}
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={`body-${status}`}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -5 }}
          transition={SPRING_SMOOTH}
        >
          {status === "watched" && (
            <div className="mt-2.5">
              <Row
                // NOT "Watched" — the badge above already says that. A row exists to add a
                // fact, not to echo the header. What it adds is WHEN.
                // "First watched" PROMISES a second — but there usually isn't one. It only earns
                // the word "first" once a rewatch has actually been logged; otherwise it's just
                // "Watched" (the WHEN still follows in the value).
                label={isSeries ? "Finished" : rewatches.length > 0 ? "First watched" : "Watched"}
                value={
                  yearEditable ? (
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="group inline-flex items-center gap-1.5 text-label font-medium text-white transition-colors hover:text-white/90"
                        >
                          {yearLabel ?? "Set year"}
                          <Pencil size={10} className="text-white/40 transition-colors group-hover:text-white/70" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent align="end" className={media.type === "film" ? "w-72 border-border-strong bg-surface-3 p-3" : "w-44 border-border-strong bg-surface-3 p-3"}>
                        <label className="mb-1.5 block text-micro text-text-tertiary">When did you watch it?</label>
                        {media.type === "film" ? (
                          // A film's date is a real timestamp → the shared picker, month and day and
                          // all, so it can be ordered precisely in Recently Watched. (A one-season
                          // series keeps a year: `season_years` is year-only by design.)
                          <WatchDatePicker
                            value={partsFromISO(media.watched_at) ?? { year: selectedYear ?? new Date().getFullYear(), month: null, day: null }}
                            onChange={onWatchedDateChange}
                            minYear={media.year ?? 1900}
                          />
                        ) : (
                          <Select value={selectedYear ? String(selectedYear) : undefined} onValueChange={(v) => onWatchedYearChange(Number(v))}>
                            <SelectTrigger variant="legacy" className="h-8 w-full border-border-subtle bg-surface-1 text-xs text-text-primary focus:ring-0">
                              <SelectValue placeholder="Pick a year" />
                            </SelectTrigger>
                            <SelectContent variant="legacy" className="border-border-strong bg-surface-3">
                              {years.map((yr) => (
                                <SelectItem key={yr} value={String(yr)} className="text-xs focus:bg-surface-2 focus:text-text-primary">{yr}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </PopoverContent>
                    </Popover>
                  ) : (
                    yearLabel ?? "—"
                  )
                }
              />
              {rewatchRows}
            </div>
          )}

          {status === "in_progress" && (
            <div className="mt-3 space-y-2.5">
              {(announcedSeasons ?? 1) > 1 && (
              <StepRow
                label="Season"
                value={currentSeason}
                total={announcedSeasons}
                max={lastSeasonOut}
                min={1}
                onDelta={(d) => {
                  const next = Math.max(1, Math.min(currentSeason + d, lastSeasonOut ?? Infinity));
                  if (next !== currentSeason) onUpdateProgress(next, 0);
                }}
              />
              )}
              <StepRow
                label="Episode"
                value={currentEpisode}
                total={announcedInSeason}
                max={airedInThisSeason}
                onDelta={(d) => {
                  const ceiling = airedInThisSeason ?? Infinity;
                  const next = Math.max(0, Math.min(currentEpisode + d, ceiling));
                  if (next !== currentEpisode) onUpdateProgress(currentSeason, next);
                }}
              />
              {/* You've seen it all — so the record of having seen it AGAIN belongs here too. */}
              {caughtUp && rewatchRows}
            </div>
          )}

          {status === "paused" && (
            <div className="mt-2.5">
              {stoppedAfter && <Row label="Stopped after" value={stoppedAfter} />}
              <p className={cn("text-label leading-relaxed text-white/60", stoppedAfter ? "mt-1.5" : "mt-0.5")}>
                Pick it back up any time.
              </p>
            </div>
          )}

          {status === "dropped" && (
            <div className="mt-2.5">
              {/* WHERE you left is the fact that was missing. "Dropped" alone doesn't say whether
                  you bailed in the pilot or left after three seasons — and those are different
                  memories. It's derived from your position, so correcting the position in Watch
                  History corrects this line too. */}
              {stoppedAfter && (
                <>
                  <Row label="Stopped after" value={stoppedAfter} />
                  <div className="h-px bg-white/10" />
                </>
              )}
              <Row
                label="Reason"
                value={
                  <Hint label="Change reason">
                    <button
                      type="button"
                      onClick={onDrop}
                      className="group inline-flex items-center gap-1.5 text-label font-medium text-white transition-colors hover:text-white/90"
                    >
                      {reason ?? "Add a reason"}
                      <Pencil size={10} className="text-white/40 transition-colors group-hover:text-white/70" />
                    </button>
                  </Hint>
                }
              />
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* ── The state's one action — it follows the state's facts. It used to sit BELOW
             "Where to watch", which made the card's primary button read as an action on the
             streaming services rather than on the title. ── */}
      <AnimatePresence mode="popLayout" initial={false}>
        {status === "want_to_watch" && (
          <motion.div key="f-want" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={SPRING_SNAPPY} className="mt-3.5">
            {isSeries ? (
              <PrimaryAction icon={<Play size={13} className="fill-current" />} onClick={onStartWatching} disabled={isUpdating}>
                Start watching
              </PrimaryAction>
            ) : releaseKnown ? (
              <PrimaryAction icon={<Check size={13} />} onClick={onMarkWatched} disabled={isUpdating}>
                Mark as watched
              </PrimaryAction>
            ) : (
              // An unreleased film: there is nothing to mark. Not an error, a fact — so the slot
              // states it plainly, and names the day, instead of offering an action to be refused.
              <div className="flex h-8 w-full items-center justify-center gap-1.5 rounded-control bg-white/10 text-label font-medium text-white/60">
                <Clock size={13} />
                Not released yet
                {media.release_date && (
                  <span className="text-white/50">
                    · {new Date(media.release_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                )}
              </div>
            )}
          </motion.div>
        )}

        {status === "in_progress" && atLastEpisode && (
          <motion.div key="f-complete" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={SPRING_SNAPPY} className="mt-3.5">
            <PrimaryAction icon={<Check size={13} />} onClick={onMarkWatched} disabled={isUpdating}>
              Mark as completed
            </PrimaryAction>
          </motion.div>
        )}

        {/* You've seen everything that's out — but the story isn't over. There's nothing to decide
            here, and a button would only invite you to say something false.
            WHAT you're waiting for matters: with 4 of season 3's 8 episodes aired, you're waiting
            a WEEK, not a year. Saying "the next season" there would be plain wrong. */}
        {status === "in_progress" && caughtUp && (
          <motion.div key="f-caught" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={SPRING_SNAPPY} className="mt-3.5">
            <div className="flex items-center gap-2 rounded-control bg-white/10 px-3 py-2 text-xs font-medium text-white/80">
              <Clock size={13} />
              {caughtUpOn(seriesFacts) === "episode"
                ? "All caught up — the next episode hasn't aired yet."
                : "All caught up — waiting on the next season."}
            </div>
          </motion.div>
        )}

        {(status === "paused" || status === "dropped") && (
          <motion.div key="f-resume" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={SPRING_SNAPPY} className="mt-3.5">
            <PrimaryAction icon={<RotateCcw size={13} />} onClick={onResume} disabled={isUpdating}>
              Resume watching
            </PrimaryAction>
          </motion.div>
        )}

        {status === "watched" && (
          <motion.div key="f-rewatch" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={SPRING_SNAPPY} className="mt-3.5">
            <PrimaryAction icon={<Plus size={13} />} onClick={() => logRewatch(todayISO())} disabled={addRewatch.isPending}>
              Log rewatch
            </PrimaryAction>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Footer: where to watch. A quiet, separated strip — it's reference, not an action
             on this card, so it closes it instead of interrupting it. ── */}
      <WhereToWatch providers={providers} />
    </section>
  );
}
