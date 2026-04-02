"use client";

import { useMemo } from "react";
import { LayoutDashboard } from "lucide-react";
import { MOCK_TODAY_TASKS } from "@/lib/dashboard/mock-data";

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function formatDate() {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function DashboardHeader() {
  const greeting = useMemo(() => getGreeting(), []);
  const date = useMemo(() => formatDate(), []);

  const todoCount = MOCK_TODAY_TASKS.filter((t) => t.status !== "done").length;
  const inProgressCount = MOCK_TODAY_TASKS.filter((t) => t.status === "in progress").length;

  return (
    <div className="flex items-start justify-between mb-8">
      {/* Left — greeting */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-6 h-6 rounded-md bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
            <LayoutDashboard size={13} className="text-indigo-400" />
          </div>
          <span className="text-xs font-semibold uppercase tracking-widest text-zinc-600">
            Dashboard
          </span>
        </div>
        <h1 className="text-2xl font-bold text-white tracking-tight">
          {greeting}, Zakaria
        </h1>
        <p className="text-sm text-zinc-500 mt-0.5">{date}</p>
      </div>

      {/* Right — quick stats */}
      <div className="flex items-center gap-3">
        <div className="flex flex-col items-center px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800/60">
          <span className="text-xl font-black text-white">{todoCount}</span>
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">To do</span>
        </div>
        <div className="flex flex-col items-center px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800/60">
          <span className="text-xl font-black text-yellow-400">{inProgressCount}</span>
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">In progress</span>
        </div>
        <div className="flex flex-col items-center px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800/60">
          <span className="text-xl font-black text-blue-400">
            {MOCK_TODAY_TASKS.filter((t) => t.status === "done").length}
          </span>
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">Done</span>
        </div>
      </div>
    </div>
  );
}
