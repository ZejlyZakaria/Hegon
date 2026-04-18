"use client";

import { useState } from "react";
import { useCurrentUserId } from "@/shared/hooks/useCurrentUserId";
import Link from "next/link";
import { AlertTriangle, Clock, Folder, ArrowRight } from "lucide-react";
import { cn } from "@/shared/utils/utils";
import { useDashboardTasks } from "../../hooks/useDashboardTasks";
import type { DashboardTask } from "../../types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PRIORITY_BADGE: Record<string, string> = {
  critical: "bg-red-500/10 border-red-500/25 text-red-400",
  high:     "bg-orange-500/10 border-orange-500/25 text-orange-400",
  medium:   "bg-yellow-500/10 border-yellow-500/25 text-yellow-400",
  low:      "bg-zinc-700/30 border-zinc-600/30 text-zinc-500",
};

function formatDueDate(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  const now = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const todayEnd   = new Date(now); todayEnd.setHours(23, 59, 59, 999);

  if (date < todayStart) {
    const diff = Math.ceil((todayStart.getTime() - date.getTime()) / 86400000);
    return diff === 1 ? "Yesterday" : `${diff}d ago`;
  }
  if (date <= todayEnd) return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  const diff = Math.ceil((date.getTime() - todayEnd.getTime()) / 86400000);
  if (diff === 1) return "Tomorrow";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ─── Task Row ─────────────────────────────────────────────────────────────────

function TaskRow({ task }: { task: DashboardTask }) {
  const dueLabel = formatDueDate(task.due_date);
  const isOverdue = task.due_date && !task.is_completed
    && new Date(task.due_date) < new Date(new Date().setHours(0, 0, 0, 0));

  return (
    <div className="group flex items-center gap-3 px-4 py-2.5 border-b border-white/4 last:border-b-0 hover:bg-white/2 transition-colors">
      <div className="shrink-0 w-4 h-4 rounded border border-zinc-700 group-hover:border-zinc-500 transition-colors" />
      {/* title — truncate */}
      <span className={cn("flex-1 min-w-0 text-sm truncate", task.is_completed ? "line-through text-zinc-600" : "text-zinc-200")}>
        {task.title}
      </span>

      {/* priority badge — fixed w-20 */}
      <div className="hidden sm:flex w-20 shrink-0">
        <span className={cn("inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border", PRIORITY_BADGE[task.priority] ?? PRIORITY_BADGE.medium)}>
          {task.priority}
        </span>
      </div>

      {/* project — fixed w-36 + truncate */}
      <div className="hidden md:flex items-center gap-1 w-36 shrink-0 text-zinc-600 min-w-0">
        <Folder size={10} className="shrink-0" />
        <span className="text-[10px] truncate">{task.project_name}</span>
      </div>

      {/* due date — fixed w-24 (fits "Tomorrow" + icon) */}
      <div className={cn("hidden sm:flex items-center gap-1 w-24 shrink-0 text-[10px]", isOverdue ? "text-red-400" : "text-zinc-500")}>
        {dueLabel && (
          <>
            <Clock size={10} className="shrink-0" />
            <span>{dueLabel}</span>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ tab }: { tab: string }) {
  const messages: Record<string, { icon: string; text: string }> = {
    today:     { icon: "✓",  text: "No tasks due today" },
    upcoming:  { icon: "📅", text: "No upcoming tasks" },
    completed: { icon: "🎉", text: "No completed tasks this week" },
  };
  const m = messages[tab] ?? messages.today;
  return (
    <div className="flex flex-col items-center justify-center h-32 gap-2">
      <span className="text-2xl">{m.icon}</span>
      <p className="text-sm text-zinc-500">{m.text}</p>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const TABS = ["today", "upcoming", "completed"] as const;
type Tab = typeof TABS[number];

export default function TasksSection() {
  const userId = useCurrentUserId();
  const [activeTab, setActiveTab] = useState<Tab>("today");
  const { todayTasks, upcomingTasks, completedTasks, overdueCount, weekTotal, weekCompleted, isLoading } =
    useDashboardTasks(userId ?? "");

  const tasksByTab: Record<Tab, DashboardTask[]> = {
    today:     todayTasks,
    upcoming:  upcomingTasks,
    completed: completedTasks,
  };
  const tabCounts: Record<Tab, number> = {
    today:     todayTasks.length,
    upcoming:  upcomingTasks.length,
    completed: completedTasks.length,
  };

  const weekProgress = weekTotal > 0 ? Math.round((weekCompleted / weekTotal) * 100) : 0;
  const activeTasks  = tasksByTab[activeTab].slice(0, 3);

  return (
    <section>
      {/* Section header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-0.5 h-3.5 rounded-full bg-zinc-400" />
          <h2 className="text-base font-semibold text-white tracking-tight">Your Tasks</h2>
          <span className="text-xs text-zinc-500 italic">· stay on track</span>
        </div>
        <Link href="/pro/tasks" className="text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors">
          View all →
        </Link>
      </div>

      {/* Tabs — own row, full width, above the grid */}
      <div className="flex items-center gap-2 mb-3 overflow-x-auto pb-0.5 scrollbar-none">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold capitalize transition-colors border",
              activeTab === tab
                ? "bg-indigo-500/15 text-indigo-300 border-indigo-500/30"
                : "text-zinc-500 hover:text-zinc-300 border-transparent",
            )}
          >
            {tab}
            {tabCounts[tab] > 0 && (
              <span className={cn(
                "text-[10px] px-1.5 py-0.5 rounded-full font-bold",
                activeTab === tab ? "bg-indigo-500/25 text-indigo-200" : "bg-zinc-800 text-zinc-500",
              )}>
                {tabCounts[tab]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Grid — table and side panel start at exactly the same level */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* ── Left: task table (2/3) ───────────────────────────────────────── */}
        <div className="md:col-span-2 rounded-2xl border border-zinc-800/60 bg-zinc-900/30 overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-5 h-5 rounded-full border-2 border-zinc-700 border-t-indigo-500 animate-spin" />
            </div>
          ) : activeTasks.length > 0 ? (
            activeTasks.map((task) => <TaskRow key={task.id} task={task} />)
          ) : (
            <EmptyState tab={activeTab} />
          )}
        </div>

        {/* ── Right: side panel (1/3) ──────────────────────────────────────── */}
        <div className="md:col-span-1 flex flex-col gap-3">

          {/* Overdue — top, auto-aligned with table top */}
          {overdueCount > 0 && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-amber-500/8 border border-amber-500/20">
              <AlertTriangle size={15} className="text-amber-400 shrink-0" />
              <span className="text-sm text-amber-300 font-semibold flex-1">
                {overdueCount} overdue task{overdueCount > 1 ? "s" : ""}
              </span>
              <Link
                href="/pro/tasks"
                className="flex items-center gap-1 text-[11px] text-amber-500 hover:text-amber-400 transition-colors whitespace-nowrap"
              >
                View all <ArrowRight size={11} />
              </Link>
            </div>
          )}

          {/* Progress — flex-1 fills remaining height, bottom aligns with table bottom */}
          <div className="flex-1 px-4 py-3 rounded-2xl border border-zinc-800/60 bg-zinc-900/30 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-400 font-medium">This week progress</span>
              <span className="text-xs font-bold text-zinc-300">{weekProgress}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-linear-to-r from-indigo-500 to-violet-500 transition-all duration-700"
                style={{ width: `${weekProgress}%` }}
              />
            </div>
            <p className="text-[11px] text-zinc-600">{weekCompleted} / {weekTotal} completed</p>
          </div>

        </div>
      </div>
    </section>
  );
}
