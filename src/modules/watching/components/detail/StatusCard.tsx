/* eslint-disable @next/next/no-img-element */
"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bookmark, CalendarPlus, Check, ChevronDown, CircleSlash, Heart,
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
import type { WatchingMedia } from "../../types";
import type { WatchProviderInfo } from "../../hooks/useWatchProviders";

// Design-system §9.1 — physical, not linear.
const SPRING_SMOOTH = { type: "spring", stiffness: 300, damping: 28 } as const;
const SPRING_SNAPPY = { type: "spring", stiffness: 400, damping: 30 } as const;

const TEAL = "var(--color-accent-watching-vivid)";

type CardStatus = "want_to_watch" | "in_progress" | "watched" | "paused" | "dropped";

// Priority mirrors deriveWatchStatus: watched > dropped > paused > in_progress.
function statusOf(media: WatchingMedia): CardStatus {
  if (media.watched) return "watched";
  if (media.dropped) return "dropped";
  if (media.paused) return "paused";
  if (media.in_progress) return "in_progress";
  return "want_to_watch";
}

// "Watched" label: films → the watched_at year; series → the season-year range.
function watchedLabel(media: WatchingMedia): string | null {
  if (media.type === "film") {
    return media.watched_at ? String(new Date(media.watched_at).getFullYear()) : null;
  }
  const years = Object.values(media.season_years ?? {}).map(Number).filter((y) => !Number.isNaN(y));
  if (!years.length) return media.watched_at ? String(new Date(media.watched_at).getFullYear()) : null;
  const min = Math.min(...years), max = Math.max(...years);
  return min === max ? String(min) : `${min} – ${max}`;
}

function watchedYearOf(media: WatchingMedia): number | null {
  if (media.type === "film") return media.watched_at ? new Date(media.watched_at).getFullYear() : null;
  return media.season_years?.["1"] ?? null;
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

function StepRow({ label, value, total, min = 0, onDelta }: {
  label: string; value: number; total: number | null; min?: number; onDelta: (d: number) => void;
}) {
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
          disabled={total != null && value >= total}
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
  onStartWatching: () => void;
  onPause: () => void;
  onDrop: () => void;                        // opens the drop-reason CaptureSheet
  onResume: () => void;
  onAddNote: () => void;                     // want_to_watch → reveals the My Take editor
  onWatchedYearChange: (year: number) => void;
  onDelete: () => void;                      // opens the shared delete-confirm modal
  isUpdating?: boolean;
}

export function StatusCard({
  media, isSeries, providers, currentSeason, currentEpisode, onUpdateProgress,
  favorite, onFavoriteToggle, onMarkWatched, onStartWatching, onPause, onDrop,
  onResume, onAddNote, onWatchedYearChange, onDelete, isUpdating,
}: Props) {
  const status: CardStatus = media.is_reference ? "want_to_watch" : statusOf(media);

  const { data: rewatches = [] } = useRewatches(status === "watched" ? media.id : "");
  const addRewatch = useAddRewatch(media.id);
  const removeRewatch = useRemoveRewatch(media.id);
  const [backdating, setBackdating] = useState(false);

  // A rewatch can't predate the title's release — constrains the date picker.
  // Series carry a full S1 air date; films only a year → floor to Jan 1.
  const releaseISO = media.season_air_dates?.[0] || (media.year ? `${media.year}-01-01` : null);

  const maxSeason = media.seasons ?? null;
  const episodesInSeason = media.season_episodes?.[currentSeason - 1] ?? null;
  const episodesInLastSeason = maxSeason != null ? (media.season_episodes?.[maxSeason - 1] ?? null) : null;
  const atLastEpisode =
    maxSeason != null && episodesInLastSeason != null &&
    currentSeason === maxSeason && currentEpisode === episodesInLastSeason;

  const reason = dropReasonLabel(media.drop_reason);

  // Year is editable where no Watch History strip owns it: films + 1-season shows.
  const seasonCount = media.season_episodes?.length ?? 0;
  const yearEditable = media.type === "film" ? media.watched : media.watched && seasonCount <= 1;
  const yearLabel = watchedLabel(media);
  const selectedYear = watchedYearOf(media);
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
            key={`chip-${status}`}
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
            {status === "in_progress" && (
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
                  {isSeries && (
                    <DropdownMenuItem onClick={onMarkWatched} className={menuItemClass}>
                      <Check size={13} /> Mark as watched
                    </DropdownMenuItem>
                  )}
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
                  <DropdownMenuItem onClick={onMarkWatched} className={menuItemClass}>
                    <Check size={13} /> Mark as watched
                  </DropdownMenuItem>
                </>
              )}
              {status === "paused" && (
                <>
                  <DropdownMenuItem onClick={onDrop} className={menuItemClass}>
                    <CircleSlash size={13} /> Drop
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onMarkWatched} className={menuItemClass}>
                    <Check size={13} /> Mark as watched
                  </DropdownMenuItem>
                </>
              )}
              {status === "dropped" && (
                <>
                  <DropdownMenuItem onClick={onMarkWatched} className={menuItemClass}>
                    <Check size={13} /> Mark as watched
                  </DropdownMenuItem>
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
                label={isSeries ? "Finished" : "First watched"}
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
                      <PopoverContent align="end" className="w-44 border-border-strong bg-surface-3 p-3">
                        <label className="mb-1 block text-micro text-text-tertiary">
                          {media.type === "film" ? "Year watched" : "Year watched"}
                        </label>
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
                      </PopoverContent>
                    </Popover>
                  ) : (
                    yearLabel ?? "—"
                  )
                }
              />
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
            </div>
          )}

          {status === "in_progress" && (
            <div className="mt-3 space-y-2.5">
              <StepRow
                label="Season"
                value={currentSeason}
                total={maxSeason}
                min={1}
                onDelta={(d) => {
                  const next = Math.max(1, Math.min(currentSeason + d, maxSeason ?? Infinity));
                  if (next !== currentSeason) onUpdateProgress(next, 0);
                }}
              />
              <StepRow
                label="Episode"
                value={currentEpisode}
                total={episodesInSeason}
                onDelta={(d) => {
                  const max = episodesInSeason ?? Infinity;
                  const next = Math.max(0, Math.min(currentEpisode + d, max));
                  if (next !== currentEpisode) onUpdateProgress(currentSeason, next);
                }}
              />
            </div>
          )}

          {status === "paused" && (
            <p className="mt-3 text-label leading-relaxed text-white/60">
              It kept its position{isSeries ? ` — S${currentSeason} · E${currentEpisode}` : ""}. Pick it back up any time.
            </p>
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
            ) : (
              <PrimaryAction icon={<Check size={13} />} onClick={onMarkWatched} disabled={isUpdating}>
                Mark as watched
              </PrimaryAction>
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
      {providers && providers.flatrate.length > 0 && (
        <div className="mt-4 border-t border-white/10 pt-3">
          <p className="text-caption uppercase tracking-wide text-white/45">Where to watch</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {providers.flatrate.slice(0, 6).map((p) =>
              p.logo_url ? (
                <Hint key={p.id} label={p.name}>
                  <img
                    src={p.logo_url}
                    alt={p.name}
                    className="h-8 w-8 rounded-control object-cover ring-1 ring-white/15"
                  />
                </Hint>
              ) : null,
            )}
          </div>
        </div>
      )}
    </section>
  );
}
