"use client";

import { motion } from "framer-motion";
import { useHabitsToday } from "@/modules/habits/hooks/useHabitsToday";
import { useDashboardData } from "@/modules/dashboard/hooks/useDashboardData";
import { DonutChart } from "../shared/DonutChart";

const HABITS_COLOR = "#f43f5e";
const TASKS_COLOR = "#71717a";

function MiniCardSkeleton() {
  return (
    <div className="flex-1 rounded-lg bg-zinc-900/50 border border-zinc-800/40 p-2.5 flex flex-col gap-2 animate-pulse">
      <div className="h-2 w-8 rounded bg-surface-2" />
      <div className="h-3.5 w-14 rounded bg-surface-2" />
      <div className="h-0.75 rounded-full bg-surface-2 mt-auto" />
    </div>
  );
}

export default function DailyScoreWidget() {
  const { completedCount, totalCount, isLoading: habitsLoading } = useHabitsToday();
  const { data, isLoading: dashLoading } = useDashboardData();
  const isLoading = habitsLoading || dashLoading;

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayTasks = (data?.tasks ?? []).filter(
    (t) => t.due_date && t.due_date.slice(0, 10) <= todayStr,
  );
  const tasksRemaining = todayTasks.length;

  const habitsPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const taskScore = tasksRemaining === 0 ? 100 : Math.max(40, 100 - Math.min(tasksRemaining, 4) * 15);
  const dailyScore = Math.round((habitsPercent + taskScore) / 2);

  return (
    <div className="rounded-xl border border-border-subtle bg-surface-1 p-4 flex flex-col gap-4">
      <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-zinc-600">Daily Score</p>

      <div className="flex justify-center">
        <DonutChart percent={dailyScore} isLoading={isLoading} />
      </div>

      <div className="flex gap-2">
        {isLoading ? (
          <>
            <MiniCardSkeleton />
            <MiniCardSkeleton />
          </>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="flex gap-2 w-full"
          >
            <div className="flex-1 rounded-lg bg-zinc-900/50 border border-zinc-800/40 p-2.5 flex flex-col gap-2">
              <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">Habits</p>
              <p className="text-[13px] font-semibold text-zinc-200 tabular-nums leading-none">
                {`${completedCount}/${totalCount}`}
              </p>
              <div className="h-0.75 rounded-full bg-zinc-800 overflow-hidden mt-auto">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${habitsPercent}%`, backgroundColor: HABITS_COLOR }}
                />
              </div>
            </div>

            <div className="flex-1 rounded-lg bg-zinc-900/50 border border-zinc-800/40 p-2.5 flex flex-col gap-2">
              <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">Tasks</p>
              <p className="text-[13px] font-semibold text-zinc-200 tabular-nums leading-none">
                {tasksRemaining === 0 ? "All done" : `${tasksRemaining} left`}
              </p>
              <div className="h-0.75 rounded-full bg-zinc-800 overflow-hidden mt-auto">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${taskScore}%`, backgroundColor: TASKS_COLOR }}
                />
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
