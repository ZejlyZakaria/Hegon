"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, MoreHorizontal, Unlink, Pencil, Trash2 } from "lucide-react";
import { Slider } from "@/shared/components/ui/slider";
import { cn } from "@/shared/utils/utils";
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
import { useUpdateGoal } from "../hooks/useGoals";
import { useLinkedTasks, useUnlinkTask } from "../hooks/useLinkedTasks";
import { MilestoneList } from "./MilestoneList";
import { GoalModal } from "./GoalModal";
import { DeleteGoalModal } from "./DeleteGoalModal";
import * as GoalService from "../service";
import { useQueryClient } from "@tanstack/react-query";
import { GOAL_KEYS } from "../hooks/query-keys";
import type { GoalStatus } from "../types";

const ACCENT = "var(--color-accent-goals)";

const PRIORITY_COLOR: Record<string, string> = {
  low:      "text-[#71717a]",
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
  const unlinkTask = useUnlinkTask(id);

  const [isEditOpen,     setIsEditOpen]     = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
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
        <div className="h-8 w-8 rounded-full border-2 border-[#141416] border-t-accent-goals animate-spin" />
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
    setLocalMode(newMode);
    await updateGoal.mutateAsync({ id, progress_mode: newMode });
    if (newMode === "auto") {
      GoalService.recalculateProgress(id).then(() => {
        queryClient.invalidateQueries({ queryKey: GOAL_KEYS.detail(id) });
        queryClient.invalidateQueries({ queryKey: GOAL_KEYS.lists() });
      });
    }
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
        className="mb-4 flex items-center gap-2 text-sm text-[#71717a] hover:text-[#a0a0a8] transition-colors"
      >
        <ArrowLeft size={14} />
        Goals
      </button>

      <div className="flex gap-6 items-start">
        {/* ── LEFT COLUMN ── */}
        <div className="flex-1 min-w-0 space-y-4">

          {/* Hero card */}
          <div className="relative overflow-hidden rounded-lg border border-white/4 bg-[#0e0e10]">
            <div className="relative p-3">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h1 className="text-xl font-semibold text-[#e2e2e6] leading-tight">{goal.title}</h1>
                    {goal.category && (
                      <span className="inline-flex items-center text-[10px] font-medium uppercase tracking-wider rounded border px-2 py-0.5 shrink-0 bg-green-500/10 text-green-400 border-green-500/20">
                        {goal.category}
                      </span>
                    )}
                  </div>
                  {goal.description && (
                    <p className="text-sm text-[#a0a0a8]">{goal.description}</p>
                  )}
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="h-8 w-8 rounded-md flex items-center justify-center text-[#71717a] hover:text-[#a0a0a8] hover:bg-[#141416] transition-colors shrink-0"
                    >
                      <MoreHorizontal size={16} />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40 rounded-xl bg-[#1a1a1d] border-white/11">
                    <DropdownMenuItem
                      onClick={() => setIsEditOpen(true)}
                      className="cursor-pointer text-[#a0a0a8] focus:text-[#e2e2e6] focus:bg-[#141416]"
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
                  <span className="text-xs text-[#71717a]">Progress</span>
                  <span className="text-sm font-medium text-[#e2e2e6]">{displayProgress}%</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-[#141416] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${displayProgress}%`,
                      backgroundColor: ACCENT,
                    }}
                  />
                </div>
                <p className="mt-1.5 text-xs text-[#71717a]">
                  {tasksCompleted}/{tasksTotal} tasks completed
                  {displayMode === "auto" && " · auto"}
                </p>
              </div>
            </div>
          </div>

          {/* Milestones */}
          <div className="relative overflow-hidden rounded-lg border border-white/4 bg-[#0e0e10] p-4">
            <MilestoneList goalId={id} />
          </div>

          {/* Linked tasks */}
          <div className="relative overflow-hidden rounded-lg border border-white/4 bg-[#0e0e10] p-4">
            <h3 className="text-xs font-medium uppercase tracking-wider text-[#71717a] mb-3">
              Fueling this Goal
            </h3>
            {linkedTasks.length === 0 ? (
              <p className="text-sm text-[#71717a]">No tasks linked yet.</p>
            ) : (
              <div className="space-y-2">
                {linkedTasks.map((task) => (
                  <div
                    key={task.id}
                    className="group flex items-center gap-3 rounded-lg border border-white/4 bg-[#0e0e10] px-3 py-2"
                  >
                    <div
                      className="h-1.5 w-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: task.completed_at ? ACCENT : "#52525b" }}
                    />
                    <span className={cn("flex-1 text-sm", task.completed_at ? "line-through text-[#71717a]" : "text-[#e2e2e6]")}>
                      {task.title}
                    </span>
                    {task.status && (
                      <span className="text-xs text-[#71717a] shrink-0">{task.status.name}</span>
                    )}
                    <button
                      type="button"
                      onClick={() => unlinkTask.mutateAsync(task.id)}
                      className="text-[#71717a] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                    >
                      <Unlink size={12} />
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
          <div className="relative overflow-hidden rounded-lg border border-white/4 bg-[#0e0e10] p-4">
            <h3 className="text-xs font-medium uppercase tracking-wider text-[#71717a] mb-3">
              Progress Control
            </h3>

            {/* Segmented toggle Manual / Auto */}
            <div className="flex rounded-md bg-[#141416] p-0.5 mb-4">
              <button
                type="button"
                onClick={() => displayMode !== "manual" && handleToggleProgressMode()}
                className={cn(
                  "flex-1 text-xs py-1.5 rounded transition-all font-medium",
                  displayMode === "manual" ? "text-[#e2e2e6]" : "text-[#71717a] hover:text-[#a0a0a8]"
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
                  displayMode === "auto" ? "text-[#e2e2e6]" : "text-[#71717a] hover:text-[#a0a0a8]"
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
                  <span className="text-sm text-[#71717a]">%</span>
                </div>

                {/* Shadcn Slider */}
                <Slider
                  value={[displayProgress]}
                  min={0}
                  max={100}
                  step={1}
                  onValueChange={([val]) => setLocalProgress(val)}
                  onValueCommit={([val]) => handleProgressSave(val)}
                  className="**:data-[slot=slider-track]:bg-[#141416] **:data-[slot=slider-range]:bg-accent-goals **:data-[slot=slider-thumb]:bg-accent-goals **:data-[slot=slider-thumb]:border-accent-goals **:data-[slot=slider-thumb]:shadow-[0_0_8px_#22c55e60]"
                />

                <p className="text-center text-xs text-[#71717a]">Drag to set progress</p>
              </div>
            ) : (
              <p className="text-xs text-[#71717a] text-center">
                Calculated from linked tasks &amp; milestones
              </p>
            )}
          </div>

          {/* Goal Info */}
          <div className="relative overflow-hidden rounded-lg border border-white/4 bg-[#0e0e10] p-4">
            <h3 className="text-xs font-medium uppercase tracking-wider text-[#71717a] mb-3">Goal Info</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-[#71717a] block mb-1">Status</label>
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
                <span className="text-xs text-[#71717a]">Priority</span>
                <span className={cn("text-xs font-medium capitalize", PRIORITY_COLOR[goal.priority])}>
                  {goal.priority}
                </span>
              </div>

              {goal.target_date && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#71717a]">Target</span>
                  <span className={cn("text-xs", isOverdue ? "text-red-400" : "text-[#a0a0a8]")}>
                    {new Date(goal.target_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    {isOverdue && " · overdue"}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-xs text-[#71717a]">Started</span>
                <span className="text-xs text-[#a0a0a8]">
                  {new Date(goal.started_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                </span>
              </div>

              {goal.completed_at && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#71717a]">Completed</span>
                  <span className="text-xs" style={{ color: ACCENT }}>
                    {new Date(goal.completed_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="relative overflow-hidden rounded-lg border border-white/4 bg-[#0e0e10] p-3">
            <h3 className="text-xs font-medium uppercase tracking-wider text-[#71717a] mb-3">Stats</h3>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-md bg-[#141416] px-3 py-2 text-center">
                <div className="text-lg font-bold text-[#e2e2e6]">{tasksTotal}</div>
                <div className="text-xs text-[#71717a]">Tasks</div>
              </div>
              <div className="rounded-md bg-[#141416] px-3 py-2 text-center">
                <div className="text-lg font-bold" style={{ color: ACCENT }}>{tasksCompleted}</div>
                <div className="text-xs text-[#71717a]">Done</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Edit modal */}
      <GoalModal open={isEditOpen} onClose={() => setIsEditOpen(false)} goal={goal} />

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