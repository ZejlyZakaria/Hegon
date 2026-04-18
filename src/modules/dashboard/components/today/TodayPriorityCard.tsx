/* eslint-disable @typescript-eslint/no-explicit-any */
import Image from "next/image";
import Link from "next/link";
import { CheckSquare, ArrowRight, Clock } from "lucide-react";
import { PriorityIcon } from "@/shared/components/icons/PriorityIcon";
import type { DashboardTask } from "../../types";

const PRIORITY_COLORS: Record<string, string> = {
  critical: "text-red-400 bg-red-500/10 border-red-500/20",
  high: "text-orange-400 bg-orange-500/10 border-orange-500/20",
  medium: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  low: "text-zinc-400 bg-zinc-500/10 border-zinc-600/20",
};

function formatDueTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const isMidnight = date.getHours() === 0 && date.getMinutes() === 0;

  if (date.toDateString() !== now.toDateString()) {
    const diff = Math.floor((date.getTime() - now.getTime()) / 86400000);
    if (diff < 0) return `${Math.abs(diff)}d overdue`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  if (isMidnight) return "Due today";
  return `Due ${date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`;
}

interface Props {
  task: DashboardTask;
  remaining?: number;
}

export default function TodayPriorityCard({ task, remaining = 0 }: Props) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-indigo-500/15 bg-zinc-950 min-h-30 flex flex-col">
      {/* Background image */}
      <Image
        src="/assets/dashboard/today-task-bg.png"
        alt=""
        fill
        unoptimized
        className="object-cover"
      />
      {/* Dark overlay */}
      {/* <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/60 to-black/25" /> */}
      {/* Indigo radial glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 0% 0%, rgba(99,102,241,0.22), transparent)",
        }}
      />
      {/* Top specular line */}
      <div className="absolute top-0 inset-x-0 h-px bg-linear-to-r from-transparent via-indigo-400/40 to-transparent" />

      <div className="relative flex flex-col flex-1 p-3 gap-2">
        <div className="flex items-center gap-2">
          <CheckSquare size={13} className="text-indigo-400" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-400">
            Priority Task
          </span>
        </div>

        <div className="flex-1 flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-white leading-snug line-clamp-2">
            {task.title}
          </h3>
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[9px] font-bold uppercase tracking-wide ${PRIORITY_COLORS[task.priority] ?? PRIORITY_COLORS.medium}`}
            >
              <PriorityIcon priority={task.priority as any} />
              {task.priority}
            </span>
            {task.due_date && (
              <span className="flex items-center gap-1 text-[10px] text-zinc-400">
                <Clock size={9} />
                {formatDueTime(task.due_date)}
              </span>
            )}
          </div>
          <p className="text-[10px] text-zinc-500 truncate">
            {task.project_name}
          </p>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-white/5">
          {remaining > 0 ? (
            <span className="text-[11px] text-zinc-500">
              +{remaining} more task{remaining > 1 ? "s" : ""}
            </span>
          ) : (
            <span className="text-[11px] text-zinc-600">View all tasks</span>
          )}
          <Link
            href="/pro/tasks"
            className="w-7 h-7 rounded-lg bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center hover:bg-indigo-500/25 transition-colors"
          >
            <ArrowRight size={13} className="text-indigo-400" />
          </Link>
        </div>
      </div>
    </div>
  );
}
