"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ArrowLeft, MoreHorizontal, Unlink, Pencil, Trash2, Plus, Search, Folder, Check, ChevronDown, Pause, TrendingUp } from "lucide-react";
import { PriorityIcon } from "@/shared/components/icons/PriorityIcon";
import { StatusIcon } from "@/shared/components/icons/StatusIcon";
import { resolveIcon } from "@/shared/constants/icons";
import { Slider } from "@/shared/components/ui/slider";
import { cn } from "@/shared/utils/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { useGoal } from "../hooks/useGoal";
import { useGoals, useUpdateGoal } from "../hooks/useGoals";
import { useLinkedTasks, useLinkTask, useUnlinkTask } from "../hooks/useLinkedTasks";
import {
  useLinkedHabits,
  useLinkHabit,
  useUnlinkHabit,
  useAvailableTasksForGoal,
  useAvailableHabitsForGoal,
} from "../hooks/useLinkedHabits";
import { useGoalContributingMedia } from "../hooks/useGoalContributingMedia";
import { useGoalContributingBooks } from "../hooks/useGoalContributingBooks";
import { useGoalContributingMatches } from "../hooks/useGoalContributingMatches";
import { FootballMatchCard } from "@/modules/sports/football/components/FootballMatchCard";
import { useGoalMomentum } from "../hooks/useGoalMomentum";
import { MilestoneList } from "./MilestoneList";
import { GoalEditPanel } from "./GoalEditPanel";
import { DeleteGoalModal } from "./DeleteGoalModal";
import { GoalDetailSkeleton } from "./GoalDetailSkeleton";
import * as GoalService from "../service";
import { useQueryClient } from "@tanstack/react-query";
import { GOAL_KEYS } from "../hooks/query-keys";
import { useRealtimeGoals } from "../hooks/useRealtimeGoals";
import { categoryColor, isGoalOverdue } from "../constants";
import { Badge } from "@/shared/components/ui/badge";
import { FadeIn } from "@/shared/components/ui/motion";
import type { GoalStatus, GoalProgressPoint } from "../types";

const ACCENT = "var(--color-accent-goals)";

// Momentum sparkline — daily progress snapshots, so the goal feels alive ("you
// went 20% → 60% this month") instead of being a single static number.
// Extend the curve flat to today so the sparkline ends "now" — showing the recent
// plateau honestly — instead of stopping at the last update.
function withToday(history: GoalProgressPoint[]): GoalProgressPoint[] {
  if (history.length === 0) return history;
  const today = new Date().toISOString().slice(0, 10);
  const last = history[history.length - 1];
  return last.recorded_on >= today ? history : [...history, { recorded_on: today, progress: last.progress }];
}

type MomentumPace = { tone: "good" | "bad" | "neutral"; status: string | null; text: string } | null;

// Momentum should answer, in 3 seconds: am I advancing? am I behind? did I progress
// recently? → a velocity headline (or a stall nudge) + the pace + a recency line,
// with a retroactive, time-accurate sparkline as support.
function MomentumCard({ history: raw, pace }: { history: GoalProgressPoint[]; pace: MomentumPace }) {
  if (raw.length === 0) {
    return (
      <div className="relative overflow-hidden surface-card rounded-card p-4">
        <h3 className="mb-3 text-xs font-semibold text-text-secondary">Momentum</h3>
        <p className="text-xs text-text-tertiary">No progress yet — your momentum builds as you make progress.</p>
      </div>
    );
  }

  const MS_DAY = 86_400_000;
  const today = new Date();
  const last = raw[raw.length - 1];
  const current = last.progress;
  const daysSince = Math.max(0, Math.round((today.getTime() - new Date(last.recorded_on).getTime()) / MS_DAY));

  // Recent velocity — progress gained over the last 30 days (the real "momentum").
  const cutoff = new Date(today.getTime() - 30 * MS_DAY).toISOString().slice(0, 10);
  const before = [...raw].reverse().find((p) => p.recorded_on <= cutoff)?.progress ?? 0;
  const delta30 = current - before;
  const stalled = daysSince >= 10;

  // Sparkline — flat-extended to today, time-accurate x-axis.
  const history = withToday(raw);
  const hasLine = history.length >= 2;
  const W = 260, H = 52, pad = 5;
  const n = history.length;
  const t0 = new Date(history[0].recorded_on).getTime();
  const t1 = new Date(history[n - 1].recorded_on).getTime();
  const span = Math.max(1, t1 - t0);
  const xs = history.map((p) => pad + ((new Date(p.recorded_on).getTime() - t0) / span) * (W - 2 * pad));
  const ys = history.map((p) => pad + (1 - p.progress / 100) * (H - 2 * pad));
  const linePath = xs.map((x, i) => `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${ys[i].toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L ${xs[n - 1].toFixed(1)} ${H} L ${xs[0].toFixed(1)} ${H} Z`;
  const since = new Date(history[0].recorded_on).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const recency = daysSince === 0 ? "today" : daysSince === 1 ? "yesterday" : `${daysSince} days ago`;

  return (
    <div className="relative overflow-hidden surface-card rounded-card p-4">
      <h3 className="mb-2 text-xs font-semibold text-text-secondary">Momentum</h3>

      {/* Headline — am I advancing right now? */}
      {stalled ? (
        <p className="flex items-center gap-2 text-xs font-medium text-amber-400">
          <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-amber-400/15">
            <Pause size={9} strokeWidth={0} fill="currentColor" />
          </span>
          No progress in {daysSince} days
        </p>
      ) : delta30 > 0 ? (
        <p className="flex items-center gap-1.5 text-xs font-medium text-green-400">
          <TrendingUp size={13} className="shrink-0" />
          +{delta30}% · last 30 days
        </p>
      ) : (
        <p className="text-xs font-medium text-text-tertiary">Steady · no recent change</p>
      )}

      {/* Pace — am I behind? (metric year goals) */}
      {pace?.status && (
        <p className="mt-0.5 text-[11px] text-text-tertiary">
          <span className={cn(
            "font-semibold",
            pace.tone === "good" ? "text-green-400" : pace.tone === "bad" ? "text-amber-400" : "text-text-tertiary",
          )}>
            {pace.status}
          </span>
          {pace.text ? ` · ${pace.text}` : ""}
        </p>
      )}

      {/* Sparkline + axis context */}
      {hasLine && (
        <>
          <svg viewBox={`0 0 ${W} ${H}`} className="mt-2.5 w-full" preserveAspectRatio="none" style={{ height: 52 }}>
            <defs>
              <linearGradient id="momentumGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={ACCENT} stopOpacity={0.22} />
                <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
              </linearGradient>
            </defs>
            <path d={areaPath} fill="url(#momentumGrad)" />
            <path d={linePath} fill="none" stroke={ACCENT} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
            <circle cx={xs[n - 1]} cy={ys[n - 1]} r={2.5} fill={ACCENT} />
          </svg>
          <div className="mt-1 flex items-center justify-between text-[10px] text-text-tertiary">
            <span>{since}</span>
            <span>today</span>
          </div>
        </>
      )}

      {/* Recency — did I progress recently? */}
      {!stalled && (
        <p className={cn("text-[11px] text-text-tertiary", hasLine ? "mt-1.5" : "mt-2")}>
          Last activity {recency}
        </p>
      )}
    </div>
  );
}

const PRIORITY_COLOR: Record<string, string> = {
  low:      "text-text-tertiary",
  medium:   "text-yellow-400",
  high:     "text-orange-400",
  critical: "text-red-400",
};

const STATUS_META: Record<GoalStatus, { label: string; color: string }> = {
  active:    { label: "Active",    color: "#22c55e" },
  completed: { label: "Completed", color: "#22c55e" },
  paused:    { label: "Paused",    color: "#fbbf24" },
  abandoned: { label: "Abandoned", color: "#a1a1aa" },
};
const STATUS_ORDER: GoalStatus[] = ["active", "completed", "paused", "abandoned"];

interface Props {
  id: string;
}

export function GoalDetailPage({ id }: Props) {
  const router      = useRouter();
  const queryClient = useQueryClient();

  const { data: goal, isLoading } = useGoal(id);
  const { data: linkedTasks   = [] } = useLinkedTasks(id);
  const { data: linkedHabits  = [] } = useLinkedHabits(id);
  const { data: availableTasks  = [] } = useAvailableTasksForGoal();
  const { data: availableHabits = [] } = useAvailableHabitsForGoal();
  const { data: contributingMedia } = useGoalContributingMedia(goal);
  const { data: contributingBooks } = useGoalContributingBooks(goal);
  const { data: contributingMatches } = useGoalContributingMatches(goal);
  const { data: progressHistory = [] } = useGoalMomentum(goal);
  const { data: allGoals = [] } = useGoals();

  useRealtimeGoals(id, linkedHabits.map((h) => h.id));

  const updateGoal  = useUpdateGoal();
  const linkTask    = useLinkTask(id);
  const unlinkTask  = useUnlinkTask(id);
  const linkHabit   = useLinkHabit(id);
  const unlinkHabit = useUnlinkHabit(id);

  const [isEditOpen,      setIsEditOpen]      = useState(false);
  const [deleteModalOpen, setDeleteModalOpen]  = useState(false);
  const [localProgress,   setLocalProgress]    = useState<number | null>(null);
  const [localMode,       setLocalMode]        = useState<"manual" | "auto" | null>(null);
  const [taskPickerOpen,  setTaskPickerOpen]   = useState(false);
  const [taskSearch,      setTaskSearch]       = useState("");
  const [statusOpen,      setStatusOpen]       = useState(false);
  const [parentOpen,      setParentOpen]       = useState(false);

  // Reset local draft when DB value confirms — prevents flicker after save
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setLocalProgress(null); }, [goal?.progress]);

  // Sync localMode once DB confirms
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setLocalMode(null); }, [goal?.progress_mode]);

  const filteredAvailableTasks = useMemo(() => {
    const q = taskSearch.trim().toLowerCase();
    if (!q) return availableTasks;
    return availableTasks.filter((t) =>
      t.title.toLowerCase().includes(q) ||
      t.project_name.toLowerCase().includes(q) ||
      t.workspace_name.toLowerCase().includes(q)
    );
  }, [availableTasks, taskSearch]);

  const groupedAvailableTasks = useMemo(() => {
    const map = new Map<string, { projectId: string; workspace: string; project: string; tasks: typeof availableTasks }>();
    filteredAvailableTasks.forEach((t) => {
      if (!map.has(t.project_id)) {
        map.set(t.project_id, { projectId: t.project_id, workspace: t.workspace_name, project: t.project_name, tasks: [] });
      }
      map.get(t.project_id)!.tasks.push(t);
    });
    return Array.from(map.values());
  }, [filteredAvailableTasks]);

  if (isLoading || !goal) return <GoalDetailSkeleton />;

  const displayMode     = localMode ?? goal.progress_mode;
  const accent          = goal.category ? categoryColor(goal.category) : ACCENT;
  const isMetric        = !!goal.metric_module;
  const isBooks         = goal.metric_module === "books";
  const isFootball      = goal.metric_module === "football";
  const contributing    = isBooks ? contributingBooks : isFootball ? contributingMatches : contributingMedia;
  // Books + Watching share the poster grid (ContributingMedia); football has its own card branch.
  const posterItems     = (isBooks ? contributingBooks : contributingMedia)?.items ?? [];
  const metricVerb      = isBooks ? "read" : isFootball ? (goal.metric_key === "stadium" ? "attended" : "watched") : "watched";
  const metricRoutePrefix = isBooks ? "/life/books/" : isFootball ? "/perso/sports/football/match/" : "/perso/watching/";
  const tasksTotal      = linkedTasks.length;
  const tasksCompleted  = linkedTasks.filter((t) => t.completed_at !== null).length;
  // Single source of truth: auto goals (task + metric) always read the server-recalc'd
  // goals.progress, so the list / timeline / compass can never diverge from the detail.
  const displayProgress = displayMode === "auto"
    ? goal.progress
    : (localProgress ?? goal.progress);
  const isOverdue       = isGoalOverdue(goal);

  // Goal↔goal links. childGoals = the goals contributing to THIS one. parentCandidates
  // excludes self + direct children (cheap loop guard) + abandoned.
  const childGoals       = allGoals.filter((g) => g.parent_goal_id === goal.id);
  const parentGoal       = allGoals.find((g) => g.id === goal.parent_goal_id) ?? null;
  const parentCandidates = allGoals.filter((g) => g.id !== goal.id && g.parent_goal_id !== goal.id && g.status !== "abandoned");

  // Watching-metric display values
  const metricTarget = goal.metric_target ?? 0;
  const metricCount  = contributing?.count ?? 0;
  const metricToGo   = Math.max(0, metricTarget - metricCount);
  const metricLabel  =
    isBooks ? "books"
    : isFootball ? (goal.metric_key === "stadium" ? "stadium visits" : "matches")
    : goal.metric_key === "films"  ? "films"
    : goal.metric_key === "series" ? "TV shows"
    : goal.metric_key === "anime"  ? "animes"
    : "titles";
  const metricPeriodLabel = goal.metric_period === "year" ? `in ${goal.metric_year}` : "all-time";

  // Pace / projection — turns the gallery into a goal dashboard ("am I on track?").
  type Pace = { tone: "good" | "bad" | "neutral"; status: string | null; text: string };
  const pace: Pace | null = (() => {
    if (!isMetric) return null;
    if (metricToGo === 0) return { tone: "good", status: "Reached 🎉", text: "" };

    if (goal.metric_period === "year" && goal.metric_year) {
      const now = new Date();
      if (goal.metric_year !== now.getFullYear()) {
        return { tone: "neutral", status: null,
          text: goal.metric_year < now.getFullYear() ? "Year ended" : "Not started yet" };
      }
      const start = new Date(goal.metric_year, 0, 1).getTime();
      const end   = new Date(goal.metric_year + 1, 0, 1).getTime();
      const frac  = Math.min(1, Math.max(0, (now.getTime() - start) / (end - start)));
      const projected = frac > 0 ? Math.round(metricCount / frac) : metricCount;
      const monthsLeft = Math.max(0, (end - now.getTime()) / (30.44 * 86_400_000));
      const perMonth  = monthsLeft > 0.1 ? Math.ceil(metricToGo / monthsLeft) : metricToGo;
      const onTrack   = metricCount >= metricTarget * frac;
      return {
        tone: onTrack ? "good" : "bad",
        status: onTrack ? "On track" : "Behind",
        text: `~${projected} projected · ~${perMonth}/mo`,
      };
    }
    return null; // all-time: no time-based forecast; Stats shows the numbers
  })();

  async function handleProgressSave(value: number) {
    const clamped = Math.min(100, Math.max(0, value));
    setLocalProgress(clamped);
    try {
      await updateGoal.mutateAsync({ id, progress: clamped });
    } catch {
      /* updateGoal's onError shows the toast (read-only demo notice or failure) */
    }
  }

  async function handleToggleProgressMode() {
    if (!goal) return;
    const newMode = goal.progress_mode === "manual" ? "auto" : "manual";
    setLocalMode(newMode);
    try {
      await updateGoal.mutateAsync({ id, progress_mode: newMode });
      if (newMode === "auto") {
        GoalService.recalculateProgress(id).then(() => {
          queryClient.invalidateQueries({ queryKey: GOAL_KEYS.detail(id) });
          queryClient.invalidateQueries({ queryKey: GOAL_KEYS.lists() });
        });
      }
    } catch {
      /* updateGoal's onError shows the toast */
    }
  }

  async function handleStatusChange(status: GoalStatus) {
    try {
      await updateGoal.mutateAsync({
        id,
        status,
        completed_at: status === "completed" ? new Date().toISOString() : null,
      });
    } catch {
      /* updateGoal's onError shows the toast */
    }
  }

  async function handleParentChange(value: string) {
    try {
      await updateGoal.mutateAsync({ id, parent_goal_id: value === "none" ? null : value });
    } catch {
      /* updateGoal's onError shows the toast */
    }
  }


  return (
    <div className="w-full">
      {/* Back — flush under the topbar, same horizontal rhythm as a tab rail */}
      <FadeIn className="px-4 sm:px-6">
        <button
          type="button"
          onClick={() => router.push("/life/goals")}
          className="flex items-center gap-2 py-2.5 text-sm text-text-tertiary hover:text-text-secondary transition-colors"
        >
          <ArrowLeft size={14} />
          Go back
        </button>
      </FadeIn>

      {/* Content — its own padding (the back link above stays flush) */}
      <div className="flex flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:gap-6 lg:items-start">
        {/* ── LEFT COLUMN ── */}
        <div className="flex-1 min-w-0 space-y-3">

          {/* Hero card */}
          <FadeIn className="relative overflow-hidden surface-card rounded-card">
            <div className="relative p-3">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex-1 min-w-0">
                  {goal.category && (
                    <Badge color={accent} uppercase className="mb-1.5">{goal.category}</Badge>
                  )}
                  <h1 className="text-xl font-semibold text-text-primary leading-tight">{goal.title}</h1>
                  {goal.description && (
                    <p className="mt-1 text-sm text-text-secondary">{goal.description}</p>
                  )}
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="h-8 w-8 rounded-control flex items-center justify-center text-text-tertiary hover:text-text-secondary hover:bg-surface-2 transition-colors shrink-0"
                    >
                      <MoreHorizontal size={16} />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40 rounded-xl bg-surface-3 border-border-strong">
                    <DropdownMenuItem
                      onClick={() => setIsEditOpen(true)}
                      className="cursor-pointer text-text-secondary focus:text-text-primary focus:bg-surface-2"
                    >
                      <Pencil className="w-3.5 h-3.5 mr-2 shrink-0" />
                      Edit goal
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setDeleteModalOpen(true)}
                      className="cursor-pointer text-red-400 focus:text-red-300 focus:bg-red-500/10"
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-2 shrink-0" />
                      Delete goal
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Progress bar */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-text-tertiary">Progress</span>
                  <span className="text-sm font-medium text-text-primary">{displayProgress}%</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-surface-2 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${displayProgress}%`,
                      backgroundColor: accent,
                    }}
                  />
                </div>
                <p className="mt-1.5 text-xs text-text-tertiary">
                  {isMetric
                    ? `${metricLabel} ${metricVerb} ${metricPeriodLabel}`
                    : `${tasksCompleted}/${tasksTotal} tasks completed${displayMode === "auto" ? " · auto" : ""}`}
                </p>
              </div>
            </div>
          </FadeIn>

          {/* Why this matters — the north star, surfaced not buried */}
          {goal.why && (
            <FadeIn
              delay={0.04}
              className="relative overflow-hidden rounded-card p-4"
              style={{
                backgroundColor: `color-mix(in srgb, ${ACCENT} 7%, var(--color-surface-1))`,
                boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${ACCENT} 18%, transparent)`,
              }}
            >
              <h3 className="mb-1.5 text-xs font-semibold" style={{ color: ACCENT }}>Why this matters</h3>
              <p className="text-sm italic leading-relaxed text-text-secondary">{goal.why}</p>
            </FadeIn>
          )}

          {/* Milestones */}
          <FadeIn delay={0.06} className="relative overflow-hidden surface-card rounded-card p-4">
            <MilestoneList goalId={id} />
          </FadeIn>

          {/* Fueling this Goal — tasks/habits (non-metric goals only) */}
          {!isMetric && (
          <FadeIn delay={0.12} className="relative overflow-hidden surface-card rounded-card p-4">
            <h3 className="text-xs font-semibold text-text-secondary mb-4">
              Fueling this Goal
            </h3>

            {/* Tasks sub-section */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold text-text-secondary">Tasks</span>
                {availableTasks.length > 0 && (
                  <Popover
                    open={taskPickerOpen}
                    onOpenChange={(o) => { setTaskPickerOpen(o); if (!o) setTaskSearch(""); }}
                  >
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="flex h-6 items-center gap-1 rounded-control bg-surface-2 px-2 text-[11px] text-text-secondary transition-colors hover:bg-surface-3"
                      >
                        <Plus size={10} />
                        Link task
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      align="end"
                      className="w-72 p-0 bg-surface-3 border-border-strong rounded-lg shadow-lg overflow-hidden"
                    >
                      {/* Search */}
                      <div className="flex items-center gap-2 border-b border-border-subtle px-3 py-2">
                        <Search size={12} className="shrink-0 text-text-tertiary" />
                        <input
                          autoFocus
                          placeholder="Search tasks..."
                          value={taskSearch}
                          onChange={(e) => setTaskSearch(e.target.value)}
                          className="flex-1 bg-transparent text-xs text-text-primary placeholder:text-text-tertiary outline-none"
                        />
                      </div>
                      {/* Grouped results */}
                      <div className="max-h-56 overflow-y-auto py-1">
                        {groupedAvailableTasks.length === 0 ? (
                          <p className="px-3 py-4 text-center text-xs text-text-tertiary">No tasks found.</p>
                        ) : (
                          groupedAvailableTasks.map((grp) => (
                            <div key={grp.projectId}>
                              <div className="flex items-center gap-1.5 px-3 pb-0.5 pt-2">
                                <Folder size={10} className="shrink-0 text-text-tertiary" />
                                <span className="truncate text-[10px] font-medium text-text-tertiary">
                                  {grp.workspace} / {grp.project}
                                </span>
                              </div>
                              {grp.tasks.map((t) => (
                                <button
                                  key={t.id}
                                  type="button"
                                  onClick={() => { linkTask.mutate(t.id); setTaskPickerOpen(false); setTaskSearch(""); }}
                                  className="flex w-full items-center gap-2 rounded-control px-3 py-1.5 transition-colors hover:bg-surface-2"
                                >
                                  <span className="h-1 w-1 shrink-0 rounded-full bg-text-tertiary" />
                                  <span className="flex-1 truncate text-left text-xs text-text-secondary">
                                    {t.title}
                                  </span>
                                </button>
                              ))}
                            </div>
                          ))
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                )}
              </div>
              {linkedTasks.length === 0 ? (
                <p className="text-xs text-text-tertiary">No tasks linked yet.</p>
              ) : (
                <div className="space-y-2">
                  {linkedTasks.map((task) => (
                    <div
                      key={task.id}
                      className="group flex items-center gap-2 rounded-control px-2 py-1.5 hover:bg-surface-2 transition-colors border border-border-subtle"
                    >
                      {/* Status icon — kanban style */}
                      <div className="shrink-0">
                        <StatusIcon status={task.status} size={14} />
                      </div>

                      {/* Title · project name inline */}
                      <p className={cn(
                        "min-w-0 flex-1 truncate text-xs",
                        task.completed_at ? "line-through text-text-tertiary" : "text-text-primary"
                      )}>
                        {task.title}
                        {task.project_name && (
                          <span className="text-text-tertiary"> · {task.project_name}</span>
                        )}
                      </p>

                      {/* Priority */}
                      <PriorityIcon priority={(task.priority ?? "medium") as "low" | "medium" | "high" | "critical" | "none"} />

                      {/* Due date */}
                      {task.due_date && (
                        <span className="shrink-0 text-[10px] text-text-tertiary">
                          {new Date(task.due_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                        </span>
                      )}

                      {/* Unlink with tooltip */}
                      <div className="relative group/unlink shrink-0">
                        <button
                          type="button"
                          onClick={() => unlinkTask.mutate(task.id)}
                          className="flex h-5 w-5 items-center justify-center rounded opacity-0 group-hover:opacity-100 text-text-tertiary hover:text-red-400 hover:bg-red-500/10 transition-all"
                        >
                          <Unlink size={11} />
                        </button>
                        <div className="pointer-events-none absolute bottom-full right-0 mb-1.5 opacity-0 group-hover/unlink:opacity-100 transition-opacity z-20">
                          <div className="rounded-control bg-surface-overlay border border-border-strong px-2 py-1 text-[10px] text-text-primary whitespace-nowrap shadow-lg">
                            Unlink task
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="h-px bg-border-subtle mb-4" />

            {/* Habits sub-section */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold text-text-secondary">Habits</span>
                {availableHabits.length > 0 && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="flex h-6 items-center gap-1 rounded-control bg-surface-2 px-2 text-[11px] text-text-secondary transition-colors hover:bg-surface-3"
                      >
                        <Plus size={10} />
                        Link habit
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      align="end"
                      className="w-60 p-1 bg-surface-3 border-border-strong rounded-lg shadow-lg"
                    >
                      <div className="max-h-48 overflow-y-auto">
                        {availableHabits.map((h) => {
                          const { icon: HabitIcon, color: habitIconColor } = resolveIcon(h.icon);
                          return (
                            <button
                              key={h.id}
                              type="button"
                              onClick={() => linkHabit.mutate(h.id)}
                              className="flex w-full items-start gap-2 rounded-control px-2 py-1.5 transition-colors hover:bg-surface-2"
                            >
                              <HabitIcon size={12} className="mt-0.5 shrink-0" style={{ color: habitIconColor }} />
                              <span className="flex-1 text-left text-xs leading-snug text-text-secondary">{h.title}</span>
                            </button>
                          );
                        })}
                      </div>
                    </PopoverContent>
                  </Popover>
                )}
              </div>
              {linkedHabits.length === 0 ? (
                <p className="text-xs text-text-tertiary">No habits linked yet.</p>
              ) : (
                <div className="space-y-0.5">
                  {linkedHabits.map((habit) => {
                    const { icon: HabitIcon, color: iconColor } = resolveIcon(habit.icon);
                    return (
                      <div
                        key={habit.id}
                        className="group flex items-center gap-2 rounded-control px-2 py-1.5 hover:bg-surface-2 transition-colors"
                      >
                        {/* Colored icon box */}
                        <div
                          className="flex h-5 w-5 shrink-0 items-center justify-center rounded"
                          style={{ color: iconColor, backgroundColor: iconColor + "20" }}
                        >
                          <HabitIcon size={11} />
                        </div>

                        {/* Title */}
                        <span className="flex-1 truncate text-xs text-text-primary">{habit.title}</span>

                        {/* Streak */}
                        {habit.current_streak > 0 && (
                          <span className="shrink-0 text-[10px] text-text-tertiary">{habit.current_streak}🔥</span>
                        )}

                        {/* Done badge */}
                        <span className={cn(
                          "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium",
                          habit.completed_today
                            ? "bg-green-500/10 text-green-400"
                            : "text-text-tertiary"
                        )}>
                          {habit.completed_today ? "Done" : "—"}
                        </span>

                        {/* Unlink with tooltip */}
                        <div className="relative group/unlink shrink-0">
                          <button
                            type="button"
                            onClick={() => unlinkHabit.mutate(habit.id)}
                            className="flex h-5 w-5 items-center justify-center rounded opacity-0 group-hover:opacity-100 text-text-tertiary hover:text-red-400 hover:bg-red-500/10 transition-all"
                          >
                            <Unlink size={11} />
                          </button>
                          <div className="pointer-events-none absolute bottom-full right-0 mb-1.5 opacity-0 group-hover/unlink:opacity-100 transition-opacity z-20">
                            <div className="rounded-control bg-surface-overlay border border-border-strong px-2 py-1 text-[10px] text-text-primary whitespace-nowrap shadow-lg">
                              Unlink habit
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </FadeIn>
          )}

          {/* Counting toward this goal — watching-metric goals */}
          {isMetric && (
            <FadeIn delay={0.12} className="relative overflow-hidden surface-card rounded-card p-4">
              <h3 className="mb-3 text-xs font-semibold text-text-secondary">
                Counting toward this goal
              </h3>

              {contributing && contributing.items.length > 0 ? (
                <>
                {isFootball ? (
                  // Real match cards — competition-coloured glow, crests · score · venue; a stadium match is a ticket.
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {(contributingMatches?.items ?? []).map((m) => (
                      <FootballMatchCard key={m.external_match_id} match={m} />
                    ))}
                  </div>
                ) : (
                  // Watching + Books share the poster grid.
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-9">
                    {posterItems.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => router.push(`${metricRoutePrefix}${m.id}`)}
                        title={m.title}
                        className="group relative aspect-2/3 cursor-pointer overflow-hidden rounded-control border border-border-subtle transition-transform duration-300 ease-out hover:z-10 hover:scale-[1.04]"
                      >
                        {m.poster_url ? (
                          <Image
                            src={m.poster_url}
                            alt={m.title}
                            fill
                            sizes="80px"
                            unoptimized
                            className="object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-surface-2 p-1 text-center text-[9px] leading-tight text-text-tertiary">
                            {m.title}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
                {metricCount > contributing.items.length && (
                  <p className="mt-2 text-[11px] text-text-tertiary">
                    +{metricCount - contributing.items.length} more
                  </p>
                )}
                </>
              ) : (
                <p className="text-xs text-text-tertiary">
                  {isBooks
                    ? "Mark books as read in Books to fill this goal."
                    : isFootball
                      ? "Log matches in Football to fill this goal."
                      : "Mark titles as watched in Watching to fill this goal."}
                </p>
              )}
            </FadeIn>
          )}
        </div>

        {/* ── RIGHT COLUMN — sticky ── */}
        <FadeIn delay={0.06} className="w-full space-y-3 lg:w-72 lg:shrink-0 lg:sticky lg:top-6">

          {/* Progress Control */}
          <div className="relative overflow-hidden surface-card rounded-card p-4">
            <h3 className="mb-3 text-xs font-semibold text-text-secondary">
              Progress Control
            </h3>

            {/* Segmented toggle Manual / Auto */}
            <div className="flex rounded-control bg-surface-2 p-0.5 mb-4">
              <button
                type="button"
                onClick={() => displayMode !== "manual" && handleToggleProgressMode()}
                className={cn(
                  "flex-1 text-xs py-1.5 rounded transition-all font-medium",
                  displayMode === "manual" ? "text-text-primary" : "text-text-tertiary hover:text-text-secondary"
                )}
                style={displayMode === "manual"
                  ? { backgroundColor: "#22c55e25", color: ACCENT }
                  : undefined}
              >
                Manual
              </button>
              <button
                type="button"
                onClick={() => displayMode !== "auto" && handleToggleProgressMode()}
                className={cn(
                  "flex-1 text-xs py-1.5 rounded transition-all font-medium",
                  displayMode === "auto" ? "text-text-primary" : "text-text-tertiary hover:text-text-secondary"
                )}
                style={displayMode === "auto"
                  ? { backgroundColor: "#22c55e25", color: ACCENT }
                  : undefined}
              >
                Auto
              </button>
            </div>

            {displayMode === "manual" ? (
              <div className="space-y-3">
                {/* Large value display */}
                <div className="flex items-baseline justify-center gap-1 py-1">
                  <span className="text-4xl font-bold tabular-nums" style={{ color: ACCENT }}>
                    {displayProgress}
                  </span>
                  <span className="text-sm text-text-tertiary">%</span>
                </div>

                {/* Shadcn Slider */}
                <Slider
                  value={[displayProgress]}
                  min={0}
                  max={100}
                  step={1}
                  onValueChange={([val]) => setLocalProgress(val)}
                  onValueCommit={([val]) => handleProgressSave(val)}
                  className="**:data-[slot=slider-track]:bg-surface-2 **:data-[slot=slider-range]:bg-accent-goals **:data-[slot=slider-thumb]:bg-accent-goals **:data-[slot=slider-thumb]:border-accent-goals **:data-[slot=slider-thumb]:shadow-[0_0_8px_#22c55e60]"
                />

                <p className="text-center text-xs text-text-tertiary">Drag to set progress</p>
              </div>
            ) : isMetric ? (
              <p className="text-xs text-text-tertiary text-center">
                Counted from {metricLabel} {metricVerb} {metricPeriodLabel}
              </p>
            ) : (
              <p className="text-xs text-text-tertiary text-center">
                Calculated from linked tasks
              </p>
            )}
          </div>

          {/* Momentum */}
          <MomentumCard history={progressHistory} pace={pace} />

          {/* Goal Info */}
          <div className="relative overflow-hidden surface-card rounded-card p-4">
            <h3 className="mb-3 text-xs font-semibold text-text-secondary">Goal Info</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-tertiary">Status</span>
                <Popover open={statusOpen} onOpenChange={setStatusOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="flex items-center gap-1.5 rounded-control bg-surface-2 px-2.5 py-1.5 text-xs text-text-secondary transition-colors hover:bg-surface-3"
                    >
                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: STATUS_META[goal.status].color }} />
                      {STATUS_META[goal.status].label}
                      <ChevronDown size={12} className="text-text-tertiary" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-40 p-1 bg-surface-3 border-border-strong">
                    {STATUS_ORDER.map((s) => {
                      // Auto goals complete themselves at the target — no manual "Completed" until then.
                      const disabled = s === "completed" && displayMode === "auto" && goal.status !== "completed";
                      return (
                        <button
                          key={s}
                          type="button"
                          disabled={disabled}
                          onClick={() => { handleStatusChange(s); setStatusOpen(false); }}
                          className={cn(
                            "flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs transition-colors",
                            disabled
                              ? "cursor-not-allowed opacity-40"
                              : goal.status === s ? "bg-surface-2 text-text-primary" : "text-text-secondary hover:bg-surface-2",
                          )}
                        >
                          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: STATUS_META[s].color }} />
                          {STATUS_META[s].label}
                          {goal.status === s && <Check size={11} className="ml-auto" />}
                        </button>
                      );
                    })}
                  </PopoverContent>
                </Popover>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-text-tertiary">Priority</span>
                <span className={cn("text-xs font-medium capitalize", PRIORITY_COLOR[goal.priority])}>
                  {goal.priority}
                </span>
              </div>

              {goal.target_date && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-text-tertiary">Target</span>
                  <span className={cn("text-xs", isOverdue ? "text-red-400" : "text-text-secondary")}>
                    {new Date(goal.target_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    {isOverdue && " · overdue"}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-xs text-text-tertiary">Started</span>
                <span className="text-xs text-text-secondary">
                  {new Date(goal.started_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                </span>
              </div>

              {goal.completed_at && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-text-tertiary">Completed</span>
                  <span className="text-xs" style={{ color: ACCENT }}>
                    {new Date(goal.completed_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Stats — the single home for the goal's numbers */}
          <div className="relative overflow-hidden surface-card rounded-card p-3">
            <h3 className="mb-3 text-xs font-semibold text-text-secondary">Stats</h3>
            {isMetric ? (
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-control bg-surface-2 px-3 py-2 text-center">
                  <div className="text-lg font-bold text-text-primary">{metricCount}</div>
                  <div className="text-xs text-text-tertiary">{isBooks ? "Read" : "Watched"}</div>
                </div>
                <div className="rounded-control bg-surface-2 px-3 py-2 text-center">
                  <div className="text-lg font-bold" style={{ color: ACCENT }}>{metricTarget}</div>
                  <div className="text-xs text-text-tertiary">Target</div>
                </div>
                <div className="rounded-control bg-surface-2 px-3 py-2 text-center">
                  <div className="text-lg font-bold text-text-primary">{metricToGo}</div>
                  <div className="text-xs text-text-tertiary">To go</div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-control bg-surface-2 px-3 py-2 text-center">
                  <div className="text-lg font-bold text-text-primary">{tasksTotal}</div>
                  <div className="text-xs text-text-tertiary">Tasks</div>
                </div>
                <div className="rounded-control bg-surface-2 px-3 py-2 text-center">
                  <div className="text-lg font-bold" style={{ color: ACCENT }}>{tasksCompleted}</div>
                  <div className="text-xs text-text-tertiary">Done</div>
                </div>
                <div className="rounded-control bg-surface-2 px-3 py-2 text-center">
                  <div className="text-lg font-bold text-text-primary">{linkedHabits.length}</div>
                  <div className="text-xs text-text-tertiary">Habits</div>
                </div>
                <div className="rounded-control bg-surface-2 px-3 py-2 text-center">
                  <div className="text-lg font-bold" style={{ color: "#f43f5e" }}>
                    {linkedHabits.filter((h) => h.completed_today).length}
                  </div>
                  <div className="text-xs text-text-tertiary">Today</div>
                </div>
              </div>
            )}
          </div>

          {/* Connections — goal↔goal links (the contributes-to chain) */}
          <div className="relative overflow-hidden surface-card rounded-card p-4">
            <h3 className="mb-3 text-xs font-semibold text-text-secondary">Connections</h3>

            <div className={cn(childGoals.length > 0 && "mb-3")}>
              <label className="mb-1 block text-[11px] text-text-tertiary">Contributes to</label>
              <Popover open={parentOpen} onOpenChange={setParentOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-2 rounded-control bg-surface-2 px-2.5 py-1.5 text-xs transition-colors hover:bg-surface-3"
                  >
                    <span className={cn("truncate", parentGoal ? "text-text-secondary" : "text-text-tertiary")}>
                      {parentGoal ? parentGoal.title : "None"}
                    </span>
                    <ChevronDown size={13} className="shrink-0 text-text-tertiary" />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="max-h-60 w-(--radix-popover-trigger-width) overflow-y-auto p-1 bg-surface-3 border-border-strong">
                  <button
                    type="button"
                    onClick={() => { handleParentChange("none"); setParentOpen(false); }}
                    className={cn(
                      "flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs transition-colors",
                      !goal.parent_goal_id ? "bg-surface-2 text-text-primary" : "text-text-secondary hover:bg-surface-2",
                    )}
                  >
                    None
                    {!goal.parent_goal_id && <Check size={11} className="ml-auto" />}
                  </button>
                  {parentCandidates.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => { handleParentChange(g.id); setParentOpen(false); }}
                      className={cn(
                        "flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs transition-colors",
                        goal.parent_goal_id === g.id ? "bg-surface-2 text-text-primary" : "text-text-secondary hover:bg-surface-2",
                      )}
                    >
                      <span className="truncate">{g.title}</span>
                      {goal.parent_goal_id === g.id && <Check size={11} className="ml-auto shrink-0" />}
                    </button>
                  ))}
                </PopoverContent>
              </Popover>
            </div>

            {childGoals.length > 0 && (
              <div>
                <label className="mb-1.5 block text-[11px] text-text-tertiary">Fueled by</label>
                <div className="space-y-1">
                  {childGoals.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => router.push(`/life/goals/${c.id}`)}
                      className="flex w-full items-center justify-between gap-2 rounded-control px-2 py-1.5 text-left transition-colors hover:bg-surface-2"
                    >
                      <span className="min-w-0 truncate text-xs text-text-secondary">{c.title}</span>
                      <span className="shrink-0 text-[10px] tabular-nums text-text-tertiary">{c.progress}%</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </FadeIn>
      </div>

      {/* Edit modal */}
      <GoalEditPanel open={isEditOpen} onClose={() => setIsEditOpen(false)} goal={goal} />

      <DeleteGoalModal
        open={deleteModalOpen}
        onOpenChange={setDeleteModalOpen}
        goalId={id}
        goalTitle={goal.title}
        onDeleted={() => router.push("/life/goals")}
      />
    </div>
  );
}