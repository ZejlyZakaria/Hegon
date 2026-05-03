"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { useGoals } from "@/modules/goals/hooks/useGoals";
import { useBooks } from "@/modules/books/hooks/useBooks";
import { useHabitsToday } from "@/modules/habits/hooks/useHabitsToday";
import { DonutChart } from "../shared/DonutChart";

// ── shared ────────────────────────────────────────────────────────────────────

const GOALS_COLOR = "#22c55e";
const HABITS_COLOR = "#f43f5e";
const BOOKS_COLOR = "#0ea5e9";

function ColLabel({ label }: { label: string }) {
  return (
    <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-zinc-600 pb-2.5 border-b border-zinc-800/60">
      {label}
    </p>
  );
}

function ProgressBar({ percent, color }: { percent: number; color: string }) {
  return (
    <div className="flex-1 h-0.75 rounded-full bg-zinc-800 overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${Math.min(percent, 100)}%`, backgroundColor: color }}
      />
    </div>
  );
}

function countCompletionsByDate(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  completions: any[]
): Record<string, number> {
  return completions.reduce<Record<string, number>>((acc, c) => {
    const date = (c.completed_date ?? c.date ?? c.completed_at ?? c.created_at ?? "").slice(0, 10);
    if (date) acc[date] = (acc[date] ?? 0) + 1;
    return acc;
  }, {});
}

// ── Goals widget ──────────────────────────────────────────────────────────────

const PRIORITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

function MilestoneRow({ title, completed, dueDate }: { title: string; completed: boolean; dueDate: string | null }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="w-2.5 h-2.5 rounded-full shrink-0 border"
        style={
          completed
            ? { backgroundColor: GOALS_COLOR + "99", borderColor: GOALS_COLOR + "60" }
            : { backgroundColor: "transparent", borderColor: "#52525b" }
        }
      />
      <p className={`text-[11px] leading-snug flex-1 min-w-0 line-clamp-1 ${completed ? "line-through text-zinc-600" : "text-zinc-300"}`}>
        {title}
      </p>
      {dueDate && !completed && (
        <span className="text-[9px] text-zinc-600 tabular-nums shrink-0">
          {new Date(dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </span>
      )}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getMilestoneWindow(milestones: any[]): any[] {
  const lastCompletedIdx = milestones.reduce(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (last: number, m: any, idx: number) => (m.status === "completed" ? idx : last),
    -1
  );
  if (lastCompletedIdx === -1) return milestones.slice(0, 2);
  return milestones.slice(lastCompletedIdx, lastCompletedIdx + 2);
}

function GoalsWidget() {
  const { data: goals = [], isLoading } = useGoals();

  const active = goals
    .filter((g) => g.status === "active")
    .sort((a, b) => {
      if (b.progress !== a.progress) return b.progress - a.progress;
      return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    });

  const displayed = active.slice(0, 2);
  const more = active.length - 2;

  return (
    <div className="flex-1 rounded-xl border border-border-subtle bg-surface-1 p-4 flex flex-col gap-2.5">
      <ColLabel label="Goals" />

      {isLoading ? (
        <div className="flex flex-col animate-pulse flex-1">
          {[0, 1].map((i) => (
            <div key={i} className={`flex flex-col gap-2 py-2.5 ${i > 0 ? "border-t border-zinc-800/50" : ""}`}>
              <div className="h-3 w-2/3 rounded bg-surface-2" />
              <div className="h-0.75 w-full rounded-full bg-surface-2" />
            </div>
          ))}
        </div>
      ) : active.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-xs text-zinc-700 italic">No active goals</p>
        </div>
      ) : (
        <div className="flex flex-col flex-1">
          {displayed.map((goal, i) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const milestones: any[] = [...(goal.milestones ?? [])].sort(
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (a: any, b: any) => (a.order_index ?? 0) - (b.order_index ?? 0)
            );
            const allCompleted =
              milestones.length > 0 && milestones.every((m) => m.status === "completed");
            const window = allCompleted ? [] : getMilestoneWindow(milestones);

            return (
              <motion.div
                key={goal.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18, delay: i * 0.05, ease: "easeOut" }}
                className={`flex flex-col gap-1.5 py-2 ${i > 0 ? "border-t border-zinc-800/50" : ""}`}
              >
                <div className="flex items-center gap-2">
                  <p className="text-[12px] font-semibold text-zinc-100 leading-snug line-clamp-1 flex-1">
                    {goal.title}
                  </p>
                  <span className="text-[10px] text-zinc-500 tabular-nums shrink-0">
                    {goal.progress}%
                  </span>
                </div>

                <ProgressBar percent={goal.progress} color={GOALS_COLOR} />

                {milestones.length === 0 ? null : allCompleted ? (
                  <p className="text-[10px] text-zinc-500 mt-0.5">All milestones complete ✓</p>
                ) : (
                  <div className="flex flex-col gap-1 mt-0.5">
                    {window.map((m) => (
                      <MilestoneRow
                        key={m.id}
                        title={m.title}
                        completed={m.status === "completed"}
                        dueDate={m.due_date ?? null}
                      />
                    ))}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      <div className="pt-1 mt-auto flex items-center justify-between">
        {more > 0 ? (
          <span className="text-[10px] text-zinc-600">+{more} more goal{more > 1 ? "s" : ""}</span>
        ) : (
          <span />
        )}
        <Link href="/life/goals" className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors">
          View goals
        </Link>
      </div>
    </div>
  );
}

// ── Habits widget ─────────────────────────────────────────────────────────────

function HabitsWidget() {
  const { recentCompletions, completedCount, totalCount, isLoading } = useHabitsToday();

  const today = new Date();
  const countByDate = countCompletionsByDate(recentCompletions as never[]);

  const weekTotal = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    return d.toISOString().slice(0, 10);
  }).reduce((sum, d) => sum + (countByDate[d] ?? 0), 0);

  const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="flex-1 rounded-xl border border-border-subtle bg-surface-1 p-4 flex flex-col gap-3">
      <ColLabel label="Habits" />

      <div className="flex items-center flex-1">
        <div className="w-1/2 flex items-center justify-center">
          <DonutChart percent={percent} isLoading={isLoading} color={HABITS_COLOR} />
        </div>

        {isLoading ? (
          <div className="w-1/2 flex flex-col gap-2 min-w-0 animate-pulse">
            <div className="flex flex-col gap-0.5">
              <div className="h-2 w-8 rounded bg-surface-2" />
              <div className="h-3.5 w-14 rounded bg-surface-2" />
            </div>
            <div className="h-px bg-zinc-800/60" />
            <div className="flex flex-col gap-0.5">
              <div className="h-2 w-14 rounded bg-surface-2" />
              <div className="h-3.5 w-10 rounded bg-surface-2" />
            </div>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="w-1/2 flex flex-col gap-2 min-w-0"
          >
            <div className="flex flex-col gap-0.5">
              <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">Today</p>
              <p className="text-[13px] font-semibold text-zinc-200 tabular-nums leading-none">
                {`${completedCount}/${totalCount}`}
                <span className="text-[10px] font-normal text-zinc-600 ml-1">done</span>
              </p>
            </div>
            <div className="h-px bg-zinc-800/60" />
            <div className="flex flex-col gap-0.5">
              <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">This week</p>
              <p className="text-[13px] font-semibold text-zinc-200 tabular-nums leading-none">
                {weekTotal}
                <span className="text-[10px] font-normal text-zinc-600 ml-1">completed</span>
              </p>
            </div>
          </motion.div>
        )}
      </div>

      <div className="mt-auto">
        <Link href="/life/habits" className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors">
          View habits
        </Link>
      </div>
    </div>
  );
}

// ── Books widget ──────────────────────────────────────────────────────────────

function BooksWidget() {
  const { data: books = [], isLoading } = useBooks({ status: "reading" });
  const book = books[0] ?? null;
  const percent =
    book?.current_page && book?.total_pages
      ? Math.round((book.current_page / book.total_pages) * 100)
      : null;

  return (
    <div className="flex-1 rounded-xl border border-border-subtle bg-surface-1 p-4 flex flex-col gap-2.5">
      <ColLabel label="Reading" />

      {isLoading ? (
        <div className="flex gap-3 animate-pulse flex-1 items-center">
          <div className="w-16 h-24 rounded bg-surface-2 shrink-0" />
          <div className="flex flex-col gap-1.5 flex-1 justify-center">
            <div className="h-3 w-3/4 rounded bg-surface-2" />
            <div className="h-3 w-1/2 rounded bg-surface-2" />
            <div className="h-2.5 w-1/2 rounded bg-surface-2 mt-0.5" />
            <div className="flex items-center gap-2 mt-1.5">
              <div className="h-0.75 flex-1 rounded-full bg-surface-2" />
              <div className="h-2.5 w-6 rounded bg-surface-2 shrink-0" />
            </div>
          </div>
        </div>
      ) : !book ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-xs text-zinc-700 italic">Nothing in progress</p>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="flex gap-3 flex-1 items-center"
        >
          {book.cover_url ? (
            <div className="relative w-16 h-24 rounded overflow-hidden shrink-0 border border-zinc-800/60">
              <Image src={book.cover_url} alt={book.title} fill sizes="64px" unoptimized className="object-cover" />
            </div>
          ) : (
            <div className="w-16 h-24 rounded bg-zinc-800 shrink-0 flex items-center justify-center border border-zinc-700/40">
              <span className="text-xl">📖</span>
            </div>
          )}
          <div className="flex flex-col gap-1.5 flex-1 min-w-0">
            <p className="text-[12px] font-semibold text-zinc-200 leading-snug line-clamp-2">
              {book.title}
            </p>
            <p className="text-[10px] text-zinc-600 truncate">{book.author}</p>
            {percent !== null && (
              <div className="flex items-center gap-2 mt-1.5">
                <ProgressBar percent={percent} color={BOOKS_COLOR} />
                <span className="text-[10px] text-zinc-500 tabular-nums shrink-0">{percent}%</span>
              </div>
            )}
          </div>
        </motion.div>
      )}

      <div className="mt-auto">
        <Link href="/life/books" className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors">
          {books.length > 1 ? `+${books.length - 1} more reading` : "View books"}
        </Link>
      </div>
    </div>
  );
}

// ── main ──────────────────────────────────────────────────────────────────────

export default function LifeStatsRow() {
  return (
    <div className="flex gap-4">
      <GoalsWidget />
      <HabitsWidget />
      <BooksWidget />
    </div>
  );
}
