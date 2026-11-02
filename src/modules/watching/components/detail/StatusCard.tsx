"use client";

import { SlidingPanel } from "@/shared/components/ui/sliding-panel";
import { Button } from "@/shared/components/ui/button";
import { useMediaHistory } from "../../hooks/useMediaHistory";
import { buildViewingSummary, viewingPanelLabel, timelineDate } from "../../lib/viewing-timeline";
import { viewingDate } from "../../lib/viewing-history";
import { watchedPeriodLabel } from "../../lib/completion-date";
import { RewatchForm } from "./RewatchForm";
import { ViewingHistory } from "./ViewingHistory";
import type { RewatchRequest, RewatchCatalogue } from "../../lib/rewatch";

import { isWatchableNow } from "../../lib/watchable";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bookmark, Check, CheckCheck, ChevronRight, CircleSlash, Clock, Heart, History,
  Minus, MoreHorizontal, PauseCircle, Pencil, Play, Plus, RotateCcw, Trash2,
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
import { caughtUpOn, nextStep, seriesState } from "../../lib/series-state";
import type { MediaView } from "../../lib/media-view";
import { canComplete, deriveWatchStatus } from "../../lib/watch-status";
import { WatchDatePicker } from "../shared/WatchDatePicker";
import { WhereToWatch } from "../shared/WhereToWatch";
import { PRIORITY, WATCHLIST_COLOR } from "../shared/Marks";
import { watchlistLevel } from "../shared/StatusBadge";
import { type WatchDateParts } from "../../lib/watched-date";
import type { WatchingMedia, WatchStatus, Rewatch } from "../../types";
import type { WatchProviderInfo } from "../../hooks/useWatchProviders";

// Design-system §9.1 — physical, not linear.
const SPRING_SMOOTH = { type: "spring", stiffness: 300, damping: 28 } as const;
const SPRING_SNAPPY = { type: "spring", stiffness: 400, damping: 30 } as const;

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

function watchedYearOf(media: WatchingMedia, yearMap: Record<string, number> | null | undefined): number | null {
  if (media.type === "film") return media.watched_at ? new Date(media.watched_at).getFullYear() : null;
  return yearMap?.["1"] ?? null;
}

const todayISO = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

// ── Card atoms (shared Watching status skin) ─────────────────────

function StateChip({ icon, children, tone = "watching" }: { icon: React.ReactNode; children: React.ReactNode; tone?: string }) {
  return (
    <span data-tone={tone} data-size="regular" className="watching-status min-w-0 text-label">
      {icon}
      <span className="truncate">{children}</span>
    </span>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 py-1.5">
      <span className="shrink-0 text-label text-white/45">{label}</span>
      <span className="min-w-0 text-right text-label font-medium text-white">{value}</span>
    </div>
  );
}

/**
 * WANT-TO-WATCH PRIORITY — the coloured bookmark's value, finally editable. The dots speak the
 * language the add modal taught (red / amber / grey), and "None" takes the bookmark off the card.
 */
const LEVELS: { value: "high" | "medium" | "low"; label: string }[] = [
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];
function PriorityPicker({ value, onChange }: { value: "high" | "medium" | "low" | null; onChange: (level: "high" | "medium" | "low" | null) => void }) {
  const current = LEVELS.find((l) => l.value === value) ?? null;
  // Controlled so a pick CLOSES the menu — a choice is a full stop, not a state to dismiss.
  const [open, setOpen] = useState(false);
  const pick = (level: "high" | "medium" | "low" | null) => { setOpen(false); onChange(level); };
  return (
    <Row
      label="Priority"
      value={
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button type="button" className="group inline-flex items-center gap-1.5 text-label font-medium text-white transition-colors hover:text-white/90">
              {current && <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: PRIORITY[current.value] }} />}
              {current?.label ?? <span className="text-white/60">None</span>}
              <Pencil size={10} className="text-white/40 transition-colors group-hover:text-white/70" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-44 overflow-hidden rounded-card border-border-default bg-surface-3 p-1 shadow-md">
            {LEVELS.map((l) => (
              <button
                key={l.value}
                type="button"
                onClick={() => pick(l.value)}
                className={cn("flex w-full items-center gap-2.5 rounded-control px-2.5 py-2 text-xs transition-colors hover:bg-surface-2", value === l.value ? "text-text-primary" : "text-text-secondary hover:text-text-primary")}
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: PRIORITY[l.value] }} />
                {l.label}
                {value === l.value && <Check size={12} className="ml-auto text-text-tertiary" />}
              </button>
            ))}
            <div className="my-1 h-px bg-border-default" />
            <button
              type="button"
              onClick={() => pick(null)}
              className="flex w-full items-center gap-2.5 rounded-control px-2.5 py-2 text-xs text-text-secondary transition-colors hover:bg-surface-2 hover:text-text-primary"
            >
              <span className="h-2 w-2 rounded-full border border-text-tertiary/60" />
              None
            </button>
          </PopoverContent>
        </Popover>
      }
    />
  );
}

/**
 * THE YEAR OF A SINGLE-SEASON TITLE — the same control whether you FINISHED it or merely CAUGHT UP.
 *
 * One picker, one writer: it edits `season_years`/`cour_years["1"]` (via the parent's handler),
 * which is the very column Watch History edits for a multi-season title. The two never coexist —
 * this shows only when there is no Watch History strip (a single display season). Year-only, because
 * `season_years` is year-only by design and because you remember "2023", not the day. The options
 * are floored so a year before the season finished airing can never be offered.
 */
function SeasonYearPicker({
  label, prompt, selectedYear, years, onChange,
}: {
  label: string;
  prompt: string;
  selectedYear: number | null;
  years: number[];
  onChange: (year: number) => void;
}) {
  return (
    <Row
      label={label}
      value={
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="group inline-flex items-center gap-1.5 text-label font-medium text-white transition-colors hover:text-white/90"
            >
              {selectedYear ?? "Set year"}
              <Pencil size={10} className="text-white/40 transition-colors group-hover:text-white/70" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-44 border-border-strong bg-surface-3 p-3">
            <label className="mb-1.5 block text-micro text-text-tertiary">{prompt}</label>
            <Select value={selectedYear ? String(selectedYear) : undefined} onValueChange={(v) => onChange(Number(v))}>
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
      }
    />
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
          aria-label={`Decrease ${label.toLowerCase()}`}
          onClick={() => onDelta(-1)}
          disabled={value <= min}
          className="flex size-11 sm:size-8 sm:pointer-coarse:size-11 items-center justify-center rounded-control bg-white/10 text-white/75 transition-colors hover:bg-white/15 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
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
          aria-label={`Increase ${label.toLowerCase()}`}
          onClick={() => onDelta(1)}
          disabled={ceiling != null && value >= ceiling}
          className="flex size-11 sm:size-8 sm:pointer-coarse:size-11 items-center justify-center rounded-control bg-white/10 text-white/75 transition-colors hover:bg-white/15 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
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
      className="flex min-h-11 w-full items-center justify-center gap-1.5 sm:min-h-9 sm:pointer-coarse:min-h-11 rounded-control bg-white text-label font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
    >
      {icon}
      {children}
    </motion.button>
  );
}

const NO_REWATCHES:Rewatch[]=[];
const menuItemClass = "gap-2.5 px-3 py-2 text-xs text-text-secondary focus:bg-surface-2 focus:text-text-primary";

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
  onCorrectPosition: (season: number, episode: number) => void;
  favorite: boolean;
  onFavoriteToggle: () => void;
  onMarkWatched: () => void;
  onMarkCaughtUp: () => void;                // series still running → the honest version of "watched"
  onStartWatching: () => void;
  onPause: () => void;
  onDrop: () => void;                        // opens the drop-reason CaptureSheet
  onResume: () => void;
  onAddNote: () => void;                     // want_to_watch → reveals the My Take editor
  /**
   * The year of a SINGLE-season/single-cour title, watched OR merely caught up. Writes the season's
   * own stamp (`season_years`/`cour_years["1"]`) — the SAME column Watch History edits for a
   * multi-season title, so there is one writer, never two. A multi-season title never calls this:
   * its Watch History strip owns every season's year.
   */
  onSeasonYearChange: (year: number) => void;
  onWatchedDateChange: (parts: WatchDateParts) => void;   // film → precise watched_at
  onPriorityChange: (level: "high" | "medium" | "low" | null) => void;   // want_to_watch → urgency
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
  media, isSeries, providers, currentSeason, currentEpisode, onUpdateProgress, onCorrectPosition, view,
  favorite, onFavoriteToggle, onMarkWatched, onMarkCaughtUp, onStartWatching, onPause, onDrop,
  onResume, onAddNote, onSeasonYearChange, onWatchedDateChange, onPriorityChange, onDelete, isUpdating,
}: Props) {
  const watchable = isWatchableNow(media);
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

  const seriesFacts = {
    ...(view ? view.seriesFacts : media),
    watched: media.watched,
    current_season: currentSeason,
    current_episode: currentEpisode,
  };
  const state = isSeries ? seriesState(seriesFacts) : null;
  const atLastEpisode = state === "completed";
  const caughtUp = state === "caught-up";

  // Eligibility follows actual consumption; posture alone does not imply a rewatch.
  const canRewatch = watchable && (isSeries ? (view?.position.episode ?? 0)>0 || (view?.position.season ?? 1)>1 || atLastEpisode || caughtUp : media.watched);

  const { data: rewatches = NO_REWATCHES } = useRewatches(media.id);
  const addRewatch = useAddRewatch(media.id, media.personal_revision);
  const removeRewatch = useRemoveRewatch(media.id, media.personal_revision);
  const [panel,setPanel]=useState<"viewing"|"rewatch"|null>(null);
  const [editingPosition,setEditingPosition]=useState(false);
  const [draftSeason,setDraftSeason]=useState(currentSeason);
  const [draftEpisode,setDraftEpisode]=useState(currentEpisode);
  const history=useMediaHistory(media.id,canRewatch || media.watched || rewatches.length>0);
  const summary=useMemo(()=>buildViewingSummary(media,history.data?.records ?? [],rewatches,view),[media,history.data,rewatches,view]);
  const historyLabel=viewingPanelLabel(summary);
  const editPosition=()=>{setDraftSeason(currentSeason);setDraftEpisode(currentEpisode);setEditingPosition(true);};


  // Editing uses announced totals and aired ceilings. Forward viewing uses the shared nextStep.
  const announcedSeasons = isSeries ? (seasons.length || media.seasons || null) : null;
  const next=isSeries ? nextStep(seriesFacts):null;
  const nextPosition=next?.kind==="episode" || next?.kind==="season" ? next:null;
  // The last season that has aired anything — the ceiling the season stepper may never pass.
  const lastSeasonOut = isSeries
    ? (seasons.reduce((last, s, i) => (s.aired > 0 ? i + 1 : last), 1))
    : null;

  const reason = dropReasonLabel(media.drop_reason);
  // ONE truth for "can this honestly be called watched": a series that is over, or a film that has
  // been released. Drives both the "…" menu item below and the want-to-watch primary action — this
  // card used to keep its own `!isSeries || isFinished` copy, which called every film completable
  // and let you mark an unreleased one as watched.
  const completable = canComplete(media);
  const releaseKnown = watchable;

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
  const markItem = !watchable ? null : completable ? (
    <DropdownMenuItem onClick={onMarkWatched} className={menuItemClass}>
      <Check size={13} /> Mark as watched
    </DropdownMenuItem>
  ) : (
    // NOT "Mark as caught up". Being caught up is a state the app DERIVES from two numbers; you do
    // not raise it like a flag, and offering to would re-teach the exact confusion that made
    // `watched` a lie. What the action really does is claim a POSITION — the last episode that
    // exists — so it says that instead, as a sentence about you.
    <DropdownMenuItem onClick={onMarkCaughtUp} className={menuItemClass}>
      <CheckCheck size={13} /> Seen everything that&apos;s out
    </DropdownMenuItem>
  );

  // THE STATUSCARD YEAR PICKER IS THE EXACT COMPLEMENT OF WATCH HISTORY — never both, never neither.
  // The strip appears for a title with more than one DISPLAY season (`view.seasons.length > 1`),
  // and it owns every season's year there. So this picker exists only when the strip does NOT: a
  // SINGLE display season. Counting DISPLAY seasons (the lens), not raw TMDB seasons, is the fix for
  // the bug this file used to have — a lumped multi-cour anime (Solo Leveling) has one TMDB season
  // but two cours, so the raw count said "1" and handed it this picker ON TOP of its Watch History
  // strip, and the picker then wrote cour 1's year while you thought you were setting the finish.
  // eslint-disable-next-line no-restricted-syntax -- the lens count is authoritative; this raw fallback runs only when no view was built (no overlay), where season_episodes IS the display space.
  const displaySeasonCount = view?.seasons.length ?? media.season_episodes?.length ?? 0;
  const singleSeason = displaySeasonCount <= 1;
  // Editable where no strip owns it: a film (any state), or a single-season series that is watched
  // OR merely caught up (a running show you've fully seen still has a year worth recording).
  const yearEditable = media.type === "film" ? media.watched : (media.watched || caughtUp) && singleSeason;
  // eslint-disable-next-line no-restricted-syntax -- explicit `view ? lens : raw` fallback for the label.
  const yearLabel = watchedPeriodLabel(media, view ? view.yearMap : media.season_years);
  // eslint-disable-next-line no-restricted-syntax -- same fallback for the selected value.
  const selectedYear = watchedYearOf(media, view ? view.yearMap : media.season_years);
  const currentYear = new Date().getFullYear();
  // ⚠️ FLOOR AT THE YEAR THE SEASON FINISHED AIRING — you cannot have watched a season through
  // before its last episode existed. `season_end_dates[0]` is the sync's last-aired date (Black
  // Clover: 2021-03-30, NOT its 2017 premiere — offering 2017 was the third bug). Falls back to the
  // premiere, then the release year. The single season is index 0, because this picker only shows
  // for a single-display-season title. Watch History floors each of its seasons the same way.
  const seasonFloorSrc = media.season_end_dates?.[0] ?? media.season_air_dates?.[0] ?? null;
  const floorYear = seasonFloorSrc ? new Date(seasonFloorSrc).getFullYear() : (media.year ?? 1900);
  const years: number[] = [];
  for (let y = currentYear; y >= Math.min(floorYear, currentYear); y--) years.push(y);


  const [rewatchDate,setRewatchDate]=useState("");
  const [editingRewatch,setEditingRewatch]=useState<Rewatch|undefined>();
  const logRewatch=(on:string) => {setRewatchDate(on);setEditingRewatch(undefined);setPanel("rewatch");};
  const saveRewatch=async (request:RewatchRequest,catalogue:RewatchCatalogue) => {
    await addRewatch.mutateAsync({request,catalogue});setPanel(null);toast("Rewatch logged.");
  };

  const handleRemoveRewatch = async (id: string) => {
    try {
      await removeRewatch.mutateAsync(id);
    } catch (err) {
      if (isDemoReadOnlyError(err)) return;
      toast.error("Failed to remove.");
    }
  };


  return (
    <>
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
            {/* The bookmark ICON wears the poster bookmark's colour — same rule (watchlistLevel):
                violet while the title is not out, then the priority's. The chip itself stays. */}
            {status === "want_to_watch" && (
              <StateChip tone="want" icon={<Bookmark size={11} fill="currentColor" style={media.is_reference ? undefined : { color: WATCHLIST_COLOR[watchlistLevel(media)] }} />}>
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
              <StateChip tone="caughtup" icon={<CheckCheck size={11} />}>Caught Up</StateChip>
            )}
            {status === "in_progress" && !caughtUp && (
              <StateChip icon={<Play size={11} fill="currentColor" />}>
                In Progress
              </StateChip>
            )}
            {status === "watched" && <StateChip tone="watched" icon={<Check size={11} />}>{isSeries ? "Completed":"Watched"}</StateChip>}
            {status === "paused" && <StateChip tone="paused" icon={<PauseCircle size={11} />}>Paused</StateChip>}
            {status === "dropped" && <StateChip tone="dropped" icon={<CircleSlash size={11} />}>Dropped</StateChip>}
          </motion.div>
        </AnimatePresence>

        <div className="flex shrink-0 items-center gap-1.5">
          {status !== "want_to_watch" && (
            <button
              type="button"
              aria-label={favorite ? "Remove from favorites" : "Add to favorites"}
              onClick={onFavoriteToggle}
              aria-pressed={favorite}
              data-active={favorite}
              className="watching-record-action focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <Heart size={13} className={cn(favorite && "fill-red-500 text-red-500")} />
            </button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="More actions"
                className="watching-record-action focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
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

              {canRewatch && <DropdownMenuItem onClick={() => logRewatch(todayISO())} className={menuItemClass}><RotateCcw size={13}/>Log rewatch</DropdownMenuItem>}
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
              {/* NOT "Watched" — the badge above already says that. A row adds a fact, not an echo of
                  the header, and the fact is WHEN. "First watched" only earns the word "first" once
                  a rewatch exists; otherwise it is just "Watched". */}
              {media.type === "film" ? (
                // A film's date is a real timestamp → the shared month/day picker, so Recently
                // Watched can order it precisely.
                yearEditable ? (
                  <Row
                    label={rewatches.length > 0 ? "First watched" : "Watched"}
                    value={
                      <Popover>
                        <PopoverTrigger asChild>
                          <button type="button" className="group inline-flex items-center gap-1.5 text-label font-medium text-white transition-colors hover:text-white/90">
                            {history.data && summary.first ? summary.first.period:media.viewing_date ? timelineDate(viewingDate(media.viewing_date)):yearLabel ?? "Date to confirm"}
                            <Pencil size={10} className="text-white/40 transition-colors group-hover:text-white/70" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent align="end" className="w-72 border-border-strong bg-surface-3 p-3">
                          <label className="mb-1.5 block text-micro text-text-tertiary">When did you watch it?</label>
                          <WatchDatePicker
                            value={media.viewing_date ?? { year: selectedYear ?? new Date().getFullYear(), month: null, day: null }}
                            onChange={onWatchedDateChange}
                            minYear={media.year ?? 1900}
                            // …AND the release MONTH, so a film out in November can't be marked
                            // watched in January of the same year. The add modal already floors the
                            // month; this surface didn't, and a year floor alone leaves that gap open.
                            minMonth={media.release_date ? new Date(media.release_date).getMonth() + 1 : 1}
                          />
                        </PopoverContent>
                      </Popover>
                    }
                  />
                ) : (
                  <Row label={rewatches.length > 0 ? "First watched" : "Watched"} value={yearLabel ?? "—"} />
                )
              ) : yearEditable ? (
                // A single-season series → the shared year picker. A multi-season one is read-only
                // here (yearLabel, possibly a range) and edited in its Watch History strip.
                <SeasonYearPicker label="Finished" prompt="When did you finish it?" selectedYear={selectedYear} years={years} onChange={onSeasonYearChange} />
              ) : (
                <div className="py-1"><p className="text-xs text-white/60">{summary.finish ? "Finished on":"Viewing period"}</p><p className="mt-1 text-xl font-semibold tabular-nums text-white">{summary.finish ? timelineDate(summary.finish):yearLabel ?? "Date to confirm"}</p>{summary.finish && yearLabel && <p className="mt-1 text-xs text-white/60">{yearLabel}</p>}</div>
              )}
            </div>
          )}

          {(status === "in_progress" || isSeries && (status === "paused" || status === "dropped")) && <div className="mt-3">
            <p className="text-xs text-white/60">{status === "paused" || status === "dropped" ? "Stopped at" : "Last watched"}</p>
            <div className="mt-1 flex items-center gap-2">
              <p className="min-w-0 text-lg font-semibold tabular-nums text-white">{currentEpisode>0 ? `S${currentSeason} · EP${currentEpisode}`:"No episodes yet"}</p>
              <button type="button" aria-label="Edit position" onClick={editPosition} className="flex size-11 shrink-0 items-center justify-center rounded-control text-white/75 hover:bg-white/10 hover:text-white can-hover:size-8 focus-visible:outline-2 focus-visible:outline-white"><Pencil size={12}/></button>
            </div>
            {media.last_watched_at && <p className="mt-1 text-xs text-white/60">{new Date(media.last_watched_at).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"})}</p>}
            {status === "in_progress" && caughtUp && singleSeason && <SeasonYearPicker label="Caught up" prompt="When did you catch up?" selectedYear={selectedYear} years={years} onChange={onSeasonYearChange}/>}
          </div>}

          {/* THE ONE FACT OF A WATCHLIST ENTRY — how much you want it. `priority_level` was written
              once, at add time (discover even hard-coded "medium"), and readable nowhere but the
              card's bookmark: a value you could see and never change. Same pen as every other
              editable fact on this card. */}
          {status === "want_to_watch" && !media.is_reference && (
            <div className="mt-2.5">
              <PriorityPicker value={media.priority_level ?? null} onChange={onPriorityChange} />
            </div>
          )}

          {status === "paused" && (
            <div className="mt-2.5">
              <p className="text-label leading-relaxed text-white/60">
                Pick it back up any time.
              </p>
            </div>
          )}

          {status === "dropped" && (
            <div className="mt-2.5">
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

      {editingPosition && <div className="mt-4 space-y-4 rounded-control bg-white/5 p-3">
        <p className="text-xs leading-relaxed text-white/65">Choose the last episode you actually watched. This corrects your progress without logging a new viewing.</p>
        {(status === "paused" || status === "dropped") && <p className="text-xs text-white/75">This title will remain {status}.</p>}
        <div className="space-y-3">
          {(announcedSeasons ?? 1)>1 && <StepRow label="Season" value={draftSeason} total={announcedSeasons} max={lastSeasonOut} min={1} onDelta={d=>{setDraftSeason(Math.max(1,Math.min(draftSeason+d,lastSeasonOut ?? 1)));setDraftEpisode(0);}}/>}
          <StepRow label="Episode" value={draftEpisode} total={seasons[draftSeason-1]?.episodes ?? null} max={seasons[draftSeason-1]?.aired ?? 0} onDelta={d=>setDraftEpisode(Math.max(0,Math.min(draftEpisode+d,seasons[draftSeason-1]?.aired ?? 0)))}/>
        </div>
        <div className="flex justify-end gap-2"><Button variant="subtle" onClick={()=>setEditingPosition(false)}>Cancel</Button><Button disabled={isUpdating} onClick={()=>{onCorrectPosition(draftSeason,draftEpisode);setEditingPosition(false);}}>Save position</Button></div>
      </div>}

      {/* ── The state's one action — it follows the state's facts. It used to sit BELOW
             "Where to watch", which made the card's primary button read as an action on the
             streaming services rather than on the title. ── */}
      <AnimatePresence mode="popLayout" initial={false}>
        {status === "want_to_watch" && (
          <motion.div key="f-want" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={SPRING_SNAPPY} className="mt-3">
            {isSeries && watchable ? (
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
              <div className="flex min-h-11 w-full items-center justify-center gap-1.5 sm:min-h-9 sm:pointer-coarse:min-h-11 rounded-control bg-white/10 text-label font-medium text-white/60">
                <Clock size={13} />
                Not released yet
                {media.release_date && (
                  <span className="text-white/50">
                    · {new Date(media.release_date + "T00:00:00").toLocaleDateString("en-GB", { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                )}
              </div>
            )}
          </motion.div>
        )}

        {!editingPosition && watchable && status==="in_progress" && nextPosition && <div className="mt-3">
          <PrimaryAction icon={<Check size={13}/>} disabled={isUpdating} onClick={()=>onUpdateProgress(nextPosition.season,nextPosition.episode)}>
            Mark {nextPosition.season!==currentSeason ? `S${nextPosition.season} · `:""}EP{nextPosition.episode} watched
          </PrimaryAction>
        </div>}

        {watchable && status === "in_progress" && atLastEpisode && (
          <motion.div key="f-complete" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={SPRING_SNAPPY} className="mt-3">
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
          <motion.div key="f-caught" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={SPRING_SNAPPY} className="mt-3">
            <div className="flex items-start gap-2 py-1 text-xs leading-relaxed text-white/65">
              <CheckCheck size={13} />
              {caughtUpOn(seriesFacts) === "episode"
                ? "All caught up — the next episode hasn't aired yet."
                : "All caught up — waiting on the next season."}
            </div>
          </motion.div>
        )}

        {watchable && (status === "paused" || status === "dropped") && (
          <motion.div key="f-resume" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={SPRING_SNAPPY} className="mt-3">
            <PrimaryAction icon={<RotateCcw size={13} />} onClick={onResume} disabled={isUpdating}>
              Resume watching
            </PrimaryAction>
          </motion.div>
        )}

      </AnimatePresence>
      {historyLabel && <button type="button" onClick={()=>setPanel("viewing")} className="mt-3 flex min-h-11 w-full items-center justify-between gap-3 border-t border-white/10 pt-2 text-sm text-white/85">
        <span className="inline-flex items-center gap-2"><History size={15}/>{historyLabel}</span><ChevronRight size={15}/>
      </button>}
      <WhereToWatch providers={providers}/>
    </section>
    <SlidingPanel open={panel!==null} onClose={()=>setPanel(null)} title={panel==="rewatch" ? editingRewatch ? "Edit rewatch":"Log rewatch":historyLabel ?? "Viewing details"}
      width="wide">
      <div className="p-4 sm:p-5">
      {panel==="viewing" && <ViewingHistory mediaType={media.type} title={media.title} poster={media.poster_url} summary={summary} loading={history.isPending} error={!!history.error} removing={removeRewatch.isPending}
        onEditRewatch={r=>{setEditingRewatch(r);setRewatchDate(r.watched_on==="Date unknown" ? "":r.watched_on);setPanel("rewatch");}}
        onRemoveRewatch={id=>{void handleRemoveRewatch(id);}}/>}
      {panel==="rewatch" && view && <RewatchForm key={`${rewatchDate}:${editingRewatch?.id ?? "new"}`} media={media} view={view} date={rewatchDate} initial={editingRewatch} firstCoverage={summary.firstCoverage} pending={addRewatch.isPending} onSave={saveRewatch} onClose={()=>setPanel(null)}/>}

      </div>
    </SlidingPanel>
    </>
  );
}
