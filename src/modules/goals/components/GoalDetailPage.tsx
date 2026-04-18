"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, MoreHorizontal, ExternalLink } from "lucide-react";
import { Slider } from "@/shared/components/ui/slider";
import { cn } from "@/shared/utils/utils";
import { Button } from "@/shared/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { useGoal } from "../hooks/useGoal";
import { useUpdateGoal, useDeleteGoal } from "../hooks/useGoals";
import { useLinkedTasks, useUnlinkTask } from "../hooks/useLinkedTasks";
import { MilestoneList } from "./MilestoneList";
import { GoalModal } from "./GoalModal";
import * as GoalService from "../service";
import { useQueryClient } from "@tanstack/react-query";
import { GOAL_KEYS } from "../hooks/query-keys";
import type { GoalStatus } from "../types";

const ACCENT = "#18ad9d";

const PRIORITY_COLOR: Record<string, string> = {
  low:      "text-zinc-400",
  medium:   "text-yellow-400",
  high:     "text-orange-400",
  critical: "text-red-400",
};

interface Props {
  id: string;
}

export function GoalDetailPage({ id }: Props) {
  const router      = useRouter();
  const queryClient = useQueryClient();

  const { data: goal, isLoading } = useGoal(id);
  const { data: linkedTasks = [] } = useLinkedTasks(id);

  const updateGoal = useUpdateGoal();
  const deleteGoal = useDeleteGoal();
  const unlinkTask = useUnlinkTask(id);

  const [isEditOpen,    setIsEditOpen]    = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [localProgress, setLocalProgress] = useState<number | null>(null);
  const [localMode,     setLocalMode]     = useState<"manual" | "auto" | null>(null);

  // Reset local draft when DB value confirms — prevents flicker after save
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setLocalProgress(null); }, [goal?.progress]);

  // Sync localMode once DB confirms
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setLocalMode(null); }, [goal?.progress_mode]);

  if (isLoading || !goal) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-8 w-8 rounded-full border-2 border-zinc-800 border-t-[#18ad9d] animate-spin" />
      </div>
    );
  }

  const displayProgress = localProgress ?? goal.progress;
  const displayMode     = localMode ?? goal.progress_mode;
  const tasksTotal      = linkedTasks.length;
  const tasksCompleted  = linkedTasks.filter((t) => t.completed_at !== null).length;
  const isOverdue       = goal.target_date && goal.status === "active" && new Date(goal.target_date) < new Date();

  async function handleProgressSave(value: number) {
    const clamped = Math.min(100, Math.max(0, value));
    setLocalProgress(clamped);
    await updateGoal.mutateAsync({ id, progress: clamped });
  }

  async function handleToggleProgressMode() {
    if (!goal) return;
    const newMode = goal.progress_mode === "manual" ? "auto" : "manual";
    setLocalMode(newMode); // optimistic — UI switches instantly
    await updateGoal.mutateAsync({ id, progress_mode: newMode });
    if (newMode === "auto") {
      // fire and forget — progress updates in background
      GoalService.recalculateProgress(id).then(() => {
        queryClient.invalidateQueries({ queryKey: GOAL_KEYS.detail(id) });
        queryClient.invalidateQueries({ queryKey: GOAL_KEYS.lists() });
      });
    }
  }

  async function handleDelete() {
    await deleteGoal.mutateAsync(id);
    router.push("/life/goals");
  }

  async function handleStatusChange(status: GoalStatus) {
    await updateGoal.mutateAsync({
      id,
      status,
      completed_at: status === "completed" ? new Date().toISOString() : null,
    });
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-4">
      {/* Back */}
      <button
        type="button"
        onClick={() => router.push("/life/goals")}
        className="mb-4 flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
      >
        <ArrowLeft size={14} />
        Goals
      </button>

      <div className="flex gap-6 items-start">
        {/* ── LEFT COLUMN ── */}
        <div className="flex-1 min-w-0 space-y-4">

          {/* Hero card */}
          <div className="relative overflow-hidden rounded-2xl border border-zinc-800/60 bg-zinc-900/80 backdrop-blur-sm">
            {/* Accent top line */}
            <div
              className="absolute top-0 inset-x-0 h-px"
              style={{ background: `linear-gradient(to right, transparent, ${ACCENT}50, transparent)` }}
            />
            {/* Diagonal gradient overlay */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{ background: `linear-gradient(to bottom right, ${ACCENT}22, #09090b 55%, #09090b)` }}
            />
            {/* Radial ambient glow — top right */}
            <div
              className="absolute top-0 right-0 w-56 h-36 pointer-events-none"
              style={{ background: `radial-gradient(ellipse at top right, ${ACCENT}15, transparent 70%)` }}
            />

            <div className="relative p-4">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex-1 min-w-0">
                  {/* Title + badge on same row */}
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h1 className="text-xl font-bold tracking-tight text-zinc-200 leading-tight">{goal.title}</h1>
                    {goal.category && (
                      <span
                        className="inline-flex items-center text-[10px] font-bold uppercase tracking-widest rounded-md px-2 py-0.5 shrink-0"
                        style={{ color: ACCENT, backgroundColor: `${ACCENT}18`, border: `1px solid ${ACCENT}30` }}
                      >
                        {goal.category}
                      </span>
                    )}
                  </div>
                  {goal.description && (
                    <p className="text-sm text-zinc-400">{goal.description}</p>
                  )}
                </div>

                {/* Actions dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="rounded-xl p-2 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/80 transition-colors shrink-0"
                    >
                      <MoreHorizontal size={16} />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40 rounded-xl bg-zinc-900 border-zinc-800">
                    <DropdownMenuItem
                      onClick={() => setIsEditOpen(true)}
                      className="cursor-pointer text-zinc-300 focus:text-zinc-100 focus:bg-zinc-800"
                    >
                      Edit goal
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setConfirmDelete(true)}
                      className="cursor-pointer text-red-400 focus:text-red-300 focus:bg-red-500/10"
                    >
                      Delete goal
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Progress bar */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-zinc-500">Progress</span>
                  <span className="text-sm font-semibold text-zinc-200">{displayProgress}%</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${displayProgress}%`,
                      background: `linear-gradient(to right, ${ACCENT}, ${ACCENT}cc)`,
                      boxShadow: displayProgress === 100 ? `0 0 8px ${ACCENT}` : undefined,
                    }}
                  />
                </div>
                <p className="mt-1.5 text-xs text-zinc-600">
                  {tasksCompleted}/{tasksTotal} tasks completed
                  {displayMode === "auto" && " · auto"}
                </p>
              </div>
            </div>
          </div>

          {/* Milestones */}
          <div className="relative overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-900/80 backdrop-blur-sm p-4">
            <MilestoneList goalId={id} />
          </div>

          {/* Linked tasks */}
          <div className="relative overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-900/80 backdrop-blur-sm p-4">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-3">
              Fueling this Goal
            </h3>
            {linkedTasks.length === 0 ? (
              <p className="text-sm text-zinc-600">No tasks linked yet.</p>
            ) : (
              <div className="space-y-2">
                {linkedTasks.map((task) => (
                  <div
                    key={task.id}
                    className="group flex items-center gap-3 rounded-xl border border-zinc-800/50 bg-zinc-900/50 px-3 py-2"
                  >
                    <div
                      className="h-1.5 w-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: task.completed_at ? ACCENT : "#52525b" }}
                    />
                    <span className={cn("flex-1 text-sm", task.completed_at ? "line-through text-zinc-600" : "text-zinc-200")}>
                      {task.title}
                    </span>
                    {task.status && (
                      <span className="text-xs text-zinc-600 shrink-0">{task.status.name}</span>
                    )}
                    <button
                      type="button"
                      onClick={() => unlinkTask.mutateAsync(task.id)}
                      className="text-zinc-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                    >
                      <ExternalLink size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT COLUMN — sticky ── */}
        <div className="w-72 shrink-0 space-y-3 sticky top-6">

          {/* Progress Control */}
          <div className="relative overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-900/80 backdrop-blur-sm p-4">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-3">
              Progress Control
            </h3>

            {/* Segmented toggle Manual / Auto */}
            <div className="flex rounded-lg bg-zinc-800/60 p-0.5 mb-4">
              <button
                type="button"
                onClick={() => displayMode !== "manual" && handleToggleProgressMode()}
                className={cn(
                  "flex-1 text-xs py-1.5 rounded-md transition-all font-medium",
                  displayMode === "manual" ? "text-zinc-100" : "text-zinc-500 hover:text-zinc-400"
                )}
                style={displayMode === "manual"
                  ? { backgroundColor: `${ACCENT}25`, color: ACCENT }
                  : undefined}
              >
                Manual
              </button>
              <button
                type="button"
                onClick={() => displayMode !== "auto" && handleToggleProgressMode()}
                className={cn(
                  "flex-1 text-xs py-1.5 rounded-md transition-all font-medium",
                  displayMode === "auto" ? "text-zinc-100" : "text-zinc-500 hover:text-zinc-400"
                )}
                style={displayMode === "auto"
                  ? { backgroundColor: `${ACCENT}25`, color: ACCENT }
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
                  <span className="text-sm text-zinc-500">%</span>
                </div>

                {/* Shadcn Slider */}
                <Slider
                  value={[displayProgress]}
                  min={0}
                  max={100}
                  step={1}
                  onValueChange={([val]) => setLocalProgress(val)}
                  onValueCommit={([val]) => handleProgressSave(val)}
                  className="**:data-[slot=slider-track]:bg-zinc-800 **:data-[slot=slider-range]:bg-[#18ad9d] **:data-[slot=slider-thumb]:bg-[#18ad9d] **:data-[slot=slider-thumb]:border-[#18ad9d] **:data-[slot=slider-thumb]:shadow-[0_0_8px_#18ad9d60]"
                />

                <p className="text-center text-xs text-zinc-600">Drag to set progress</p>
              </div>
            ) : (
              <p className="text-xs text-zinc-600 text-center">
                Calculated from linked tasks &amp; milestones
              </p>
            )}
          </div>

          {/* Goal Info */}
          <div className="relative overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-900/80 backdrop-blur-sm p-4">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-3">Goal Info</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-zinc-500 block mb-1">Status</label>
                <Select value={goal.status} onValueChange={(v) => handleStatusChange(v as GoalStatus)}>
                  <SelectTrigger variant="tasks" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent variant="tasks">
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="paused">Paused</SelectItem>
                    <SelectItem value="abandoned">Abandoned</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500">Priority</span>
                <span className={cn("text-xs font-medium capitalize", PRIORITY_COLOR[goal.priority])}>
                  {goal.priority}
                </span>
              </div>

              {goal.target_date && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-500">Target</span>
                  <span className={cn("text-xs", isOverdue ? "text-red-400" : "text-zinc-300")}>
                    {new Date(goal.target_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    {isOverdue && " · overdue"}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500">Started</span>
                <span className="text-xs text-zinc-400">
                  {new Date(goal.started_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                </span>
              </div>

              {goal.completed_at && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-500">Completed</span>
                  <span className="text-xs" style={{ color: ACCENT }}>
                    {new Date(goal.completed_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="relative overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-900/80 backdrop-blur-sm p-3">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-3">Stats</h3>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-zinc-800/60 px-3 py-2 text-center">
                <div className="text-lg font-bold text-zinc-200">{tasksTotal}</div>
                <div className="text-xs text-zinc-500">Tasks</div>
              </div>
              <div className="rounded-xl bg-zinc-800/60 px-3 py-2 text-center">
                <div className="text-lg font-bold" style={{ color: ACCENT }}>{tasksCompleted}</div>
                <div className="text-xs text-zinc-500">Done</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Edit modal */}
      <GoalModal open={isEditOpen} onClose={() => setIsEditOpen(false)} goal={goal} />

      {/* Delete confirm */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setConfirmDelete(false)} />
          <div className="relative w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-4 shadow-2xl">
            <h3 className="mb-2 text-sm font-semibold tracking-tight text-zinc-200">Delete goal?</h3>
            <p className="mb-5 text-xs text-zinc-500">
              This will delete the goal and all its milestones. Tasks linked to it will not be deleted.
            </p>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setConfirmDelete(false)}
                className="border-zinc-700/50 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50"
              >
                Cancel
              </Button>
              <Button type="button" variant="destructive" onClick={handleDelete}>
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
