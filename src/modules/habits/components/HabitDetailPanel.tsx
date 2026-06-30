"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import {
  CalendarClock,
  CalendarOff,
  Check,
  Film,
  Flame,
  Pause,
  Play,
  Snowflake,
  Sparkles,
  SkipForward,
  Target,
  Trash2,
  Trophy,
  X,
} from "lucide-react";

import { cn } from "@/shared/utils/utils";
import { resolveIcon } from "@/shared/constants/icons";
import { IconPicker } from "@/shared/components/ui/icon-picker";
import { Calendar as DatePicker } from "@/shared/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/components/ui/popover";
import { toast } from "@/shared/utils/toast";
import { useIsDemo } from "@/modules/settings/hooks/useSettings";
import { DemoReadOnlyError, handledDemoError } from "@/shared/utils/demo-guard";

import * as HabitService from "../service";
import { HABIT_KEYS } from "../hooks/query-keys";
import { useHabitsUIStore } from "../store";
import { useHabits } from "../hooks/useHabits";
import { useHabitsToday } from "../hooks/useHabitsToday";
import { useHabitStats } from "../hooks/useHabitStats";
import { useGoals } from "@/modules/goals/hooks/useGoals";
import {
  useHabitPauses,
  useHabitFreezes,
  useMonthlyFreezeCount,
  useSkipDay,
  useUnskipDay,
  useAddPause,
  useRemovePause,
  useFreezeDay,
  useUnfreezeDay,
  MONTHLY_FREEZE_BUDGET,
} from "../hooks/useHabitSchedule";
import { getDaysAgoStr, getTodayStr, toDateStr, formatFrequency } from "../utils";
import type { HabitWithStatus, HabitFrequency, UpdateHabitInput } from "../types";

const ACCENT = "var(--color-accent-habits-vivid)";
const FIRE = "var(--color-fire)";
const ICE = "var(--color-ice)";
const GOLD = "var(--color-gold)";
const SPRING = { type: "spring", damping: 30, stiffness: 280 } as const;

const DAYS = [
  { label: "Su", value: 0 },
  { label: "Mo", value: 1 },
  { label: "Tu", value: 2 },
  { label: "We", value: 3 },
  { label: "Th", value: 4 },
  { label: "Fr", value: 5 },
  { label: "Sa", value: 6 },
];

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const SOURCE_KEY_LABEL: Record<string, string> = {
  film: "Films",
  serie: "Series",
  anime: "Animes",
};

const DEFAULT_STATUS = {
  completed_today: false,
  completion_id: null,
  completion_time: null,
  at_risk: false,
  skipped_today: false,
  is_paused: false,
  current_streak: 0,
  best_streak: 0,
};

function preferredDay(dates: string[]): string | null {
  if (dates.length < 5) return null;
  const counts = new Array(7).fill(0);
  for (const d of dates) counts[new Date(d + "T12:00:00").getDay()]++;
  const max = Math.max(...counts);
  if (max === 0) return null;
  return WEEKDAYS[counts.indexOf(max)];
}

interface Props {
  onDelete: (habit: HabitWithStatus) => void;
}

// ─── Root — reads the open target from the store ────────────────────────────────

export function HabitDetailPanel({ onDelete }: Props) {
  const { openHabitId, closePanel } = useHabitsUIStore();
  const { data: allHabits = [] } = useHabits();
  const { habits, pausedHabits } = useHabitsToday();

  // Use the cached status object directly (stable reference) so the panel does
  // not re-create `habit` on every render — that churn caused hover/focus flicker.
  // Fall back to the base habit only when it isn't in Today (paused, or not
  // scheduled today) so the panel still opens for it.
  const status =
    habits.find((h) => h.id === openHabitId) ??
    pausedHabits.find((h) => h.id === openHabitId) ??
    null;
  const base = allHabits.find((h) => h.id === openHabitId) ?? null;
  const habit: HabitWithStatus | null =
    status ?? (base ? { ...base, ...DEFAULT_STATUS } : null);
  const hasStatus = !!status;

  useEffect(() => {
    if (!openHabitId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePanel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openHabitId, closePanel]);

  useEffect(() => {
    if (openHabitId && allHabits.length > 0 && !base) closePanel();
  }, [openHabitId, allHabits.length, base, closePanel]);

  return (
    <AnimatePresence>
      {openHabitId && habit && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-40 bg-black/50"
            onClick={closePanel}
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={SPRING}
            className="fixed right-0 top-0 z-50 flex h-full w-full flex-col border-l border-border-strong bg-surface-1 sm:w-108"
          >
            <PanelBody
              key={habit.id}
              habit={habit}
              hasStatus={hasStatus}
              onClose={closePanel}
              onDelete={() => {
                closePanel();
                onDelete(habit);
              }}
            />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ─── Body ────────────────────────────────────────────────────────────────────────

function PanelBody({
  habit,
  hasStatus,
  onClose,
  onDelete,
}: {
  habit: HabitWithStatus;
  hasStatus: boolean;
  onClose: () => void;
  onDelete: () => void;
}) {
  const today = getTodayStr();
  const qc = useQueryClient();
  const isDemo = useIsDemo();

  const { stats } = useHabitStats(habit);
  const { data: pauses = [] } = useHabitPauses(habit.id);
  const { data: goals = [] } = useGoals();

  const { data: freezes = [] } = useHabitFreezes(habit.id);
  const { data: usedThisMonth = 0 } = useMonthlyFreezeCount();
  const remainingFreezes = Math.max(MONTHLY_FREEZE_BUDGET - usedThisMonth, 0);

  const skipDay = useSkipDay();
  const unskipDay = useUnskipDay();
  const addPause = useAddPause();
  const removePause = useRemovePause();
  const freezeDay = useFreezeDay();
  const unfreezeDay = useUnfreezeDay();

  // Silent inline patch (no per-keystroke toast).
  const patchMut = useMutation({
    mutationFn: (input: UpdateHabitInput) => {
      if (isDemo) throw new DemoReadOnlyError();
      return HabitService.updateHabit(input);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: HABIT_KEYS.all }),
    onError: (error) => { if (handledDemoError(error)) return; toast.error("Failed to update habit."); },
  });
  const patch = (fields: Omit<UpdateHabitInput, "id">) =>
    patchMut.mutate({ id: habit.id, ...fields });

  // Editable title + description (commit on blur).
  const [localTitle, setLocalTitle] = useState(habit.title);
  const [localDesc, setLocalDesc] = useState(habit.description ?? "");
  const savedTitle = useRef(habit.title);
  const savedDesc = useRef(habit.description ?? "");
  const titleEl = useRef<HTMLTextAreaElement>(null);
  const descEl = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!titleEl.current) return;
    titleEl.current.style.height = "auto";
    titleEl.current.style.height = `${titleEl.current.scrollHeight}px`;
  }, [localTitle]);
  useEffect(() => {
    if (!descEl.current) return;
    descEl.current.style.height = "auto";
    descEl.current.style.height = `${descEl.current.scrollHeight}px`;
  }, [localDesc]);

  function commitTitle() {
    const t = localTitle.trim();
    if (!t) {
      setLocalTitle(savedTitle.current);
      return;
    }
    if (t !== savedTitle.current) {
      savedTitle.current = t;
      patch({ title: t });
    }
  }
  function commitDesc() {
    const next = localDesc.trim() || null;
    const prev = savedDesc.current || null;
    if (next !== prev) {
      savedDesc.current = next ?? "";
      patch({ description: next });
    }
  }

  // Frequency editing
  const [freqOpen, setFreqOpen] = useState(false);
  const days = habit.custom_days ?? [];
  function setFrequency(f: HabitFrequency) {
    if (f === "daily") patch({ frequency: "daily", custom_days: null });
    // weekly: keep the existing day if any, else null = "any day this week"
    else if (f === "weekly")
      patch({ frequency: "weekly", custom_days: days.length ? [days[0]] : null });
    else patch({ frequency: "custom", custom_days: days.length ? days : [1] });
  }
  function toggleDay(day: number) {
    if (habit.frequency === "weekly") {
      // weekly: toggling the selected day off → null = any day this week
      patch({ custom_days: days.includes(day) ? null : [day] });
    } else {
      const next = days.includes(day) ? days.filter((d) => d !== day) : [...days, day];
      if (next.length >= 1) patch({ custom_days: next });
    }
  }

  // Goal editing
  const [goalOpen, setGoalOpen] = useState(false);
  const activeGoals = goals.filter((g) => g.status === "active" || g.id === habit.goal_id);
  const currentGoal = goals.find((g) => g.id === habit.goal_id) ?? null;

  // Source (auto-track) editing
  const [sourceOpen, setSourceOpen] = useState(false);
  const sourceLabel =
    habit.source_module === "watching"
      ? `Watching${habit.source_key ? ` · ${SOURCE_KEY_LABEL[habit.source_key] ?? habit.source_key}` : ""}`
      : "Manual";

  // Icon editing
  const [iconOpen, setIconOpen] = useState(false);
  const { icon: Icon, color: iconColor } = resolveIcon(habit.icon);

  // 90-day completions (shared cache key) → preferred-day insight
  const from90 = getDaysAgoStr(89);
  const { data: comps = [] } = useQuery({
    queryKey: HABIT_KEYS.completionsRange(habit.id, from90, today),
    queryFn: () => HabitService.getHabitCompletionsRange(habit.id, from90, today),
    staleTime: 1000 * 60 * 5,
  });
  // React Compiler memoizes these; manual useMemo conflicts with the `today` dep.
  const completedDates = comps.map((c) => c.completed_date);
  const favDay = preferredDay(completedDates);

  // Pause form
  const [pauseStart, setPauseStart] = useState<Date | undefined>(new Date());
  const [pauseEnd, setPauseEnd] = useState<Date | undefined>(undefined);
  const [startOpen, setStartOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);

  // Freeze picker — only the last 14 days, never today or the future
  const [freezeOpen, setFreezeOpen] = useState(false);
  const freezeFloor = getDaysAgoStr(13);

  const activePauses = pauses.filter(
    (p) => today >= p.pause_start && (p.pause_end === null || today <= p.pause_end),
  );

  function submitPause() {
    if (!pauseStart || addPause.isPending) return;
    addPause.mutate(
      {
        habitId: habit.id,
        start: toDateStr(pauseStart),
        end: pauseEnd ? toDateStr(pauseEnd) : null,
      },
      {
        onSuccess: () => {
          setPauseStart(new Date());
          setPauseEnd(undefined);
        },
      },
    );
  }
  function resumeNow() {
    if (removePause.isPending) return;
    activePauses.forEach((p) => removePause.mutate(p.id));
  }

  return (
    <>
      {/* Header */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border-strong px-4">
        <span className="text-xs text-text-tertiary">Habit</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onDelete}
            aria-label="Delete habit"
            className="flex h-7 w-7 items-center justify-center rounded-control text-text-tertiary transition-colors hover:bg-red-500/10 hover:text-red-400"
          >
            <Trash2 size={14} />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-7 w-7 items-center justify-center rounded-control text-text-tertiary transition-colors hover:bg-surface-3 hover:text-text-primary"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {/* Title + editable icon */}
        <div className="flex items-start gap-3 px-5 pb-4 pt-5">
          <Popover open={iconOpen} onOpenChange={setIconOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label="Change icon"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-tile border border-border-subtle bg-surface-3 transition-colors hover:border-border-default"
                style={{ color: iconColor }}
              >
                <Icon size={20} />
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              className="w-auto border-border-strong bg-surface-3 p-3"
            >
              <IconPicker
                value={habit.icon}
                onChange={(key) => {
                  patch({ icon: key, color: resolveIcon(key).color });
                  setIconOpen(false);
                }}
                accentColor={ACCENT}
              />
            </PopoverContent>
          </Popover>

          <div className="min-w-0 flex-1">
            <textarea
              ref={titleEl}
              value={localTitle}
              onChange={(e) => setLocalTitle(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  titleEl.current?.blur();
                }
              }}
              rows={1}
              placeholder="Habit title…"
              className="w-full resize-none overflow-hidden bg-transparent text-[17px] font-semibold leading-snug text-text-primary outline-none placeholder:text-text-tertiary"
            />
            <textarea
              ref={descEl}
              value={localDesc}
              onChange={(e) => setLocalDesc(e.target.value)}
              onBlur={commitDesc}
              rows={1}
              placeholder="Add a description…"
              className="mt-1 w-full resize-none overflow-hidden bg-transparent text-sm leading-relaxed text-text-secondary outline-none placeholder:text-text-tertiary"
            />
          </div>
        </div>

        {/* Properties */}
        <div className="border-t border-border-subtle px-5">
          {/* Frequency */}
          <Prop label="Frequency">
            <Popover open={freqOpen} onOpenChange={setFreqOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-1.5 rounded-control px-2 py-1 text-xs text-text-secondary transition-colors hover:bg-surface-3"
                >
                  {formatFrequency(habit)}
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-56 border-border-strong bg-surface-3 p-2">
                <div className="space-y-0.5">
                  {(["daily", "weekly", "custom"] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFrequency(f)}
                      className={cn(
                        "flex w-full items-center justify-between rounded px-2 py-1.5 text-xs capitalize transition-colors",
                        habit.frequency === f
                          ? "bg-surface-2 text-text-primary"
                          : "text-text-secondary hover:bg-surface-2",
                      )}
                    >
                      {f === "custom" ? "Custom days" : f}
                      {habit.frequency === f && <Check size={11} />}
                    </button>
                  ))}
                </div>
                {habit.frequency !== "daily" && (
                  <div className="mt-2 flex gap-1 border-t border-border-subtle pt-2">
                    {DAYS.map((d) => {
                      const on = days.includes(d.value);
                      return (
                        <button
                          key={d.value}
                          type="button"
                          onClick={() => toggleDay(d.value)}
                          className={cn(
                            "h-7 flex-1 rounded text-[11px] font-semibold transition-colors",
                            on ? "text-white" : "bg-surface-2 text-text-tertiary hover:text-text-primary",
                          )}
                          style={on ? { backgroundColor: ACCENT } : undefined}
                        >
                          {d.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </PopoverContent>
            </Popover>
          </Prop>

          {/* Goal */}
          <Prop label="Goal">
            <Popover open={goalOpen} onOpenChange={setGoalOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-1.5 rounded-control px-2 py-1 text-xs text-text-secondary transition-colors hover:bg-surface-3"
                >
                  <Target
                    size={13}
                    className={currentGoal ? "" : "text-text-tertiary"}
                    style={currentGoal ? { color: "var(--color-accent-goals)" } : undefined}
                  />
                  {currentGoal ? (
                    <span className="max-w-44 truncate">{currentGoal.title}</span>
                  ) : (
                    <span className="text-text-tertiary">No goal</span>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-64 border-border-strong bg-surface-3 p-1">
                <button
                  type="button"
                  onClick={() => {
                    patch({ goal_id: null });
                    setGoalOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs transition-colors",
                    !habit.goal_id ? "bg-surface-2 text-text-primary" : "text-text-secondary hover:bg-surface-2",
                  )}
                >
                  No goal
                  {!habit.goal_id && <Check size={11} className="ml-auto" />}
                </button>
                {activeGoals.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => {
                      patch({ goal_id: g.id });
                      setGoalOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs transition-colors",
                      habit.goal_id === g.id ? "bg-surface-2 text-text-primary" : "text-text-secondary hover:bg-surface-2",
                    )}
                  >
                    <Target size={12} className="shrink-0" style={{ color: "var(--color-accent-goals)" }} />
                    <span className="truncate">{g.title}</span>
                    {habit.goal_id === g.id && <Check size={11} className="ml-auto shrink-0" />}
                  </button>
                ))}
              </PopoverContent>
            </Popover>
          </Prop>

          {/* Auto-track (cross-module source) */}
          <Prop label="Auto-track">
            <Popover open={sourceOpen} onOpenChange={setSourceOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-1.5 rounded-control px-2 py-1 text-xs text-text-secondary transition-colors hover:bg-surface-3"
                >
                  <Film
                    size={13}
                    className={habit.source_module ? "" : "text-text-tertiary"}
                    style={habit.source_module ? { color: ACCENT } : undefined}
                  />
                  <span className={habit.source_module ? "" : "text-text-tertiary"}>
                    {sourceLabel}
                  </span>
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-56 border-border-strong bg-surface-3 p-2">
                <div className="space-y-0.5">
                  <button
                    type="button"
                    onClick={() => { patch({ source_module: null, source_key: null }); setSourceOpen(false); }}
                    className={cn(
                      "flex w-full items-center justify-between rounded px-2 py-1.5 text-xs transition-colors",
                      !habit.source_module ? "bg-surface-2 text-text-primary" : "text-text-secondary hover:bg-surface-2",
                    )}
                  >
                    Manual
                    {!habit.source_module && <Check size={11} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => patch({ source_module: "watching" })}
                    className={cn(
                      "flex w-full items-center justify-between rounded px-2 py-1.5 text-xs transition-colors",
                      habit.source_module === "watching" ? "bg-surface-2 text-text-primary" : "text-text-secondary hover:bg-surface-2",
                    )}
                  >
                    From Watching
                    {habit.source_module === "watching" && <Check size={11} />}
                  </button>
                </div>

                {habit.source_module === "watching" && (
                  <div className="mt-2 space-y-0.5 border-t border-border-subtle pt-2">
                    {([
                      { label: "Anything", key: null },
                      { label: "Films", key: "film" },
                      { label: "Series", key: "serie" },
                      { label: "Animes", key: "anime" },
                    ] as const).map((opt) => {
                      const active = (habit.source_key ?? null) === opt.key;
                      return (
                        <button
                          key={opt.label}
                          type="button"
                          onClick={() => { patch({ source_key: opt.key }); setSourceOpen(false); }}
                          className={cn(
                            "flex w-full items-center justify-between rounded px-2 py-1.5 text-xs transition-colors",
                            active ? "bg-surface-2 text-text-primary" : "text-text-secondary hover:bg-surface-2",
                          )}
                        >
                          {opt.label}
                          {active && <Check size={11} />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </PopoverContent>
            </Popover>
          </Prop>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2.5 px-5 py-4">
          <Stat
            icon={<Flame size={14} />}
            label="Current streak"
            value={hasStatus ? `${habit.current_streak}d` : "—"}
            color={FIRE}
          />
          <Stat
            icon={<Trophy size={14} />}
            label="Best streak"
            value={hasStatus ? `${habit.best_streak}d` : "—"}
            color={GOLD}
          />
          <Stat label="30-day rate" value={stats ? `${stats.completion_rate_30d}%` : "—"} />
          <Stat label="Total" value={stats ? `${stats.total_completions}` : "—"} />
        </div>

        {/* Insight */}
        {favDay && (
          <div className="mx-5 mb-4 flex items-center gap-2.5 rounded-card border border-border-subtle bg-surface-2 px-3.5 py-3">
            <Sparkles size={15} style={{ color: ACCENT }} className="shrink-0" />
            <p className="text-xs text-text-secondary">
              You&apos;re most consistent on{" "}
              <span className="font-semibold text-text-primary">{favDay}</span>.
            </p>
          </div>
        )}

        {habit.is_paused ? (
          /* ── Paused — only Resume makes sense ── */
          <div className="border-t border-border-subtle px-5 py-4">
            <p className="mb-2 text-xs font-medium text-text-tertiary">Status</p>
            <div className="rounded-card border border-border-subtle bg-surface-2 px-3.5 py-3">
              <div className="flex items-center gap-2">
                <Pause size={14} style={{ color: ACCENT }} className="shrink-0" />
                <span className="text-sm font-medium text-text-primary">Paused</span>
              </div>
              {activePauses[0] && (
                <p className="mt-1 text-xs text-text-tertiary">
                  {format(new Date(activePauses[0].pause_start + "T12:00:00"), "MMM d")}
                  {" – "}
                  {activePauses[0].pause_end
                    ? format(new Date(activePauses[0].pause_end + "T12:00:00"), "MMM d")
                    : "ongoing"}
                  {". Streak frozen, hidden from Today."}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={resumeNow}
              disabled={removePause.isPending}
              className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-control px-3 py-2 text-sm font-medium text-white transition-[opacity,transform] duration-150 ease-out hover:opacity-90 active:scale-[0.99] disabled:opacity-40"
              style={{ backgroundColor: ACCENT }}
            >
              <Play size={14} />
              Resume habit
            </button>
            <p className="mt-2 text-[11px] leading-relaxed text-text-tertiary">
              Resuming brings it back to Today and the streak continues where it left off.
            </p>
          </div>
        ) : (
          <>
            {/* Skip today */}
            <div className="border-t border-border-subtle px-5 py-4">
              <p className="mb-2 text-xs font-medium text-text-tertiary">Today</p>
              {habit.skipped_today ? (
                <div className="flex items-center justify-between rounded-card border border-border-subtle bg-surface-2 px-3.5 py-2.5">
                  <span className="inline-flex items-center gap-2 text-sm text-text-secondary">
                    <SkipForward size={14} style={{ color: ACCENT }} />
                    Skipped today
                  </span>
                  <button
                    type="button"
                    onClick={() => unskipDay.mutate({ habitId: habit.id, date: today })}
                    disabled={unskipDay.isPending}
                    className="text-xs font-medium text-text-tertiary transition-colors hover:text-text-primary active:scale-95"
                  >
                    Undo
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => skipDay.mutate({ habitId: habit.id, date: today })}
                  disabled={skipDay.isPending || habit.completed_today}
                  className="flex w-full items-center gap-2 rounded-card border border-border-subtle bg-surface-2 px-3.5 py-2.5 text-sm text-text-secondary transition-colors hover:bg-surface-3 hover:text-text-primary active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <SkipForward size={14} />
                  Skip today
                  <span className="ml-auto text-[11px] text-text-tertiary">streak stays safe</span>
                </button>
              )}
            </div>

            {/* Streak protection (freezes) */}
            <div className="border-t border-border-subtle px-5 py-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-medium text-text-tertiary">Streak protection</p>
                <span className="inline-flex items-center gap-1 text-[11px] text-text-tertiary">
                  <Snowflake size={11} style={{ color: ICE }} />
                  {remainingFreezes} of {MONTHLY_FREEZE_BUDGET} left
                </span>
              </div>

              {freezes.length > 0 && (
                <div className="mb-2 space-y-1.5">
                  {freezes.map((f) => (
                    <div
                      key={f.id}
                      className="flex items-center justify-between rounded-card border border-border-subtle bg-surface-2 px-3.5 py-2.5"
                    >
                      <span className="inline-flex items-center gap-2 text-xs text-text-secondary">
                        <Snowflake size={13} style={{ color: ICE }} />
                        {format(new Date(f.freeze_date + "T12:00:00"), "MMM d")} protected
                      </span>
                      <button
                        type="button"
                        onClick={() => unfreezeDay.mutate({ habitId: habit.id, date: f.freeze_date })}
                        disabled={unfreezeDay.isPending}
                        className="text-xs font-medium text-text-tertiary transition-colors hover:text-text-primary active:scale-95"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {remainingFreezes > 0 ? (
                <div className="flex">
                  <DateField
                    label="Freeze a missed day"
                    icon={<Snowflake size={13} />}
                    value={undefined}
                    open={freezeOpen}
                    onOpenChange={setFreezeOpen}
                    onSelect={(d) => {
                      if (d) freezeDay.mutate({ habitId: habit.id, date: toDateStr(d) });
                      setFreezeOpen(false);
                    }}
                    disabled={(d) => {
                      const ds = toDateStr(d);
                      return ds >= today || ds < freezeFloor;
                    }}
                  />
                </div>
              ) : (
                <p className="text-[11px] text-text-tertiary">No freezes left this month.</p>
              )}
              <p className="mt-2 text-[11px] leading-relaxed text-text-tertiary">
                A freeze protects one missed day so the streak keeps going.{" "}
                {MONTHLY_FREEZE_BUDGET} per month.
              </p>
            </div>

            {/* Pause */}
            <div className="border-t border-border-subtle px-5 py-4">
              <p className="mb-2 text-xs font-medium text-text-tertiary">Pause</p>

              {pauses.length > 0 && (
                <div className="mb-3 space-y-1.5">
                  {pauses.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between rounded-card border border-border-subtle bg-surface-2 px-3.5 py-2.5"
                    >
                      <span className="inline-flex items-center gap-2 text-xs text-text-secondary">
                        <CalendarOff size={13} className="text-text-tertiary" />
                        {format(new Date(p.pause_start + "T12:00:00"), "MMM d")}
                        {" – "}
                        {p.pause_end
                          ? format(new Date(p.pause_end + "T12:00:00"), "MMM d")
                          : "ongoing"}
                      </span>
                      <button
                        type="button"
                        onClick={() => removePause.mutate(p.id)}
                        disabled={removePause.isPending}
                        className="text-xs font-medium text-text-tertiary transition-colors hover:text-text-primary active:scale-95"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-2">
                <DateField
                  label="From"
                  icon={<CalendarClock size={13} />}
                  value={pauseStart}
                  open={startOpen}
                  onOpenChange={setStartOpen}
                  onSelect={(d) => {
                    setPauseStart(d);
                    setStartOpen(false);
                  }}
                />
                <DateField
                  label="To (optional)"
                  icon={<CalendarOff size={13} />}
                  value={pauseEnd}
                  open={endOpen}
                  onOpenChange={setEndOpen}
                  onSelect={(d) => {
                    setPauseEnd(d);
                    setEndOpen(false);
                  }}
                  disabled={(d) => !!pauseStart && d < pauseStart}
                  clearable
                  onClear={() => {
                    setPauseEnd(undefined);
                    setEndOpen(false);
                  }}
                />
              </div>
              <button
                type="button"
                onClick={submitPause}
                disabled={!pauseStart || addPause.isPending}
                className="mt-2.5 w-full rounded-control px-3 py-2 text-sm font-medium text-white transition-[opacity,transform] duration-150 ease-out hover:opacity-90 active:scale-[0.99] disabled:opacity-40"
                style={{ backgroundColor: ACCENT }}
              >
                Pause this habit
              </button>
              <p className="mt-2 text-[11px] leading-relaxed text-text-tertiary">
                While paused, the habit is hidden from Today and its streak is frozen,
                then resumes where it left off.
              </p>
            </div>
          </>
        )}
      </div>
    </>
  );
}

// ─── Small pieces ────────────────────────────────────────────────────────────────

function Prop({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-10 items-center gap-3 border-b border-border-subtle last:border-0">
      <span className="w-20 shrink-0 text-xs text-text-tertiary">{label}</span>
      <div className="flex min-w-0 flex-1 items-center">{children}</div>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  accent,
  color,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  accent?: boolean;
  color?: string;
}) {
  const tint = color ?? (accent ? ACCENT : undefined);
  return (
    <div className="rounded-card border border-border-subtle bg-surface-2 px-3.5 py-3">
      <div className="flex items-center gap-1.5 text-[11px] text-text-tertiary">
        {icon && <span style={tint ? { color: tint } : undefined}>{icon}</span>}
        {label}
      </div>
      <p
        className="mt-1 text-xl font-bold leading-none"
        style={{ color: tint ?? "var(--color-text-primary)" }}
      >
        {value}
      </p>
    </div>
  );
}

function DateField({
  label,
  icon,
  value,
  open,
  onOpenChange,
  onSelect,
  disabled,
  clearable,
  onClear,
}: {
  label: string;
  icon: React.ReactNode;
  value: Date | undefined;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSelect: (d: Date | undefined) => void;
  disabled?: (d: Date) => boolean;
  clearable?: boolean;
  onClear?: () => void;
}) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex flex-1 items-center gap-1.5 rounded-control border border-border-subtle bg-surface-2 px-3 py-2 text-xs transition-colors hover:border-border-default",
            value ? "text-text-secondary" : "text-text-tertiary",
          )}
        >
          {icon}
          {value ? format(value, "MMM d") : label}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto border-border-strong bg-surface-3 p-0">
        <DatePicker
          mode="single"
          selected={value}
          onSelect={onSelect}
          disabled={disabled}
          className="bg-surface-3"
        />
        {clearable && value && (
          <div className="border-t border-border-subtle p-2">
            <button
              type="button"
              onClick={onClear}
              className="w-full rounded px-2 py-1 text-left text-xs text-text-tertiary transition-colors hover:bg-surface-2 hover:text-text-primary"
            >
              Clear end date
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
