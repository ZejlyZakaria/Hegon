"use client";

import Link from "next/link";
import { ArrowRight, CheckSquare } from "lucide-react";
import { cn } from "@/lib/utils/utils";
import { PriorityIcon } from "@/components/tasks/PriorityIcon";
import { StatusIcon } from "@/components/tasks/StatusIcon";
import { MOCK_TODAY_TASKS } from "@/lib/dashboard/mock-data";

type Priority = "critical" | "high" | "medium" | "low";

function TaskRow({ task }: { task: typeof MOCK_TODAY_TASKS[number] }) {
  const isDone = task.status === "done";

  return (
    <div
      className={cn(
        "group flex items-center gap-3 px-4 py-2.5",
        "border-b border-white/[0.04] last:border-b-0",
        "hover:bg-white/[0.02] transition-colors duration-100",
      )}
    >
      <div className="shrink-0 w-4 flex items-center justify-center">
        <PriorityIcon priority={task.priority as Priority} />
      </div>
      <div className="shrink-0 w-4 flex items-center justify-center">
        <StatusIcon status={task.status} size={14} />
      </div>
      <span
        className={cn(
          "flex-1 text-sm truncate leading-tight",
          isDone ? "text-zinc-600 line-through" : "text-zinc-200",
        )}
      >
        {task.title}
      </span>
      <span className="hidden sm:block shrink-0 text-[10px] text-zinc-700 font-medium px-1.5 py-0.5 rounded bg-zinc-800/50">
        {task.project}
      </span>
    </div>
  );
}

export function DashboardTodayTasks() {
  const pending = MOCK_TODAY_TASKS.filter((t) => t.status !== "done");
  const done = MOCK_TODAY_TASKS.filter((t) => t.status === "done");

  return (
    <div className="flex flex-col h-full rounded-2xl border border-zinc-800/60 bg-zinc-900/30 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-zinc-800/60">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-md bg-zinc-800 flex items-center justify-center">
            <CheckSquare size={13} className="text-zinc-400" />
          </div>
          <span className="text-sm font-semibold text-white">Today&apos;s Tasks</span>
          <span className="text-[11px] text-zinc-500 font-medium px-1.5 py-0.5 rounded-full bg-zinc-800 border border-zinc-700/50">
            {MOCK_TODAY_TASKS.length}
          </span>
        </div>
        <Link
          href="/pro/tasks"
          className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors font-medium"
        >
          View all
          <ArrowRight size={11} />
        </Link>
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto">
        {/* Pending tasks */}
        {pending.length > 0 && (
          <div>
            {pending.map((task) => (
              <TaskRow key={task.id} task={task} />
            ))}
          </div>
        )}

        {/* Done tasks */}
        {done.length > 0 && (
          <div>
            <div className="px-4 py-2 flex items-center gap-2">
              <div className="flex-1 h-px bg-zinc-800/80" />
              <span className="text-[10px] text-zinc-600 uppercase tracking-widest font-semibold">
                Completed · {done.length}
              </span>
              <div className="flex-1 h-px bg-zinc-800/80" />
            </div>
            {done.map((task) => (
              <TaskRow key={task.id} task={task} />
            ))}
          </div>
        )}

        {MOCK_TODAY_TASKS.length === 0 && (
          <div className="flex flex-col items-center justify-center h-40 gap-2 text-center px-6">
            <CheckSquare size={20} className="text-zinc-700" />
            <p className="text-sm text-zinc-600">No tasks for today</p>
            <Link
              href="/pro/tasks"
              className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              Create one →
            </Link>
          </div>
        )}
      </div>

      {/* Footer progress bar */}
      <div className="px-4 py-3 border-t border-zinc-800/60">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] text-zinc-600">Progress</span>
          <span className="text-[11px] text-zinc-400 font-semibold">
            {done.length}/{MOCK_TODAY_TASKS.length}
          </span>
        </div>
        <div className="h-1 rounded-full bg-zinc-800 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-500"
            style={{ width: `${MOCK_TODAY_TASKS.length > 0 ? (done.length / MOCK_TODAY_TASKS.length) * 100 : 0}%` }}
          />
        </div>
      </div>
    </div>
  );
}
