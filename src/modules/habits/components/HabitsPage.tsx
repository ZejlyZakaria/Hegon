"use client";

import { useState } from "react";
import {
  Search,
  Coffee,
  TrendingUp,
  Flame,
  Zap,
  Trophy,
  Sparkles,
} from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/utils/utils";
import { useHabits } from "../hooks/useHabits";
import {
  useHabitsToday,
  useCompleteHabit,
  useUncompleteHabit,
} from "../hooks/useHabitsToday";
import { HabitsEmptyState } from "./HabitsEmptyState";
import { HabitCard } from "./HabitCard";
import { HabitModal } from "./HabitModal";
import { HabitsRightPanel } from "./HabitsRightPanel";
import { HabitsCalendarView } from "./HabitsCalendarView";
import { AllHabitsHeatmap } from "./AllHabitsHeatmap";
import type { HabitTab } from "../types";

const ACCENT = "var(--color-accent-habits)";

// ─── Topbar ───────────────────────────────────────────────────────────────────

function HabitsTopbar({
  search,
  onSearchChange,
}: {
  search: string;
  onSearchChange: (v: string) => void;
}) {
  return (
    <div className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b border-white/4 bg-[#09090b]/80 px-4 backdrop-blur-sm">
      <div className="relative max-w-xs flex-1">
        <Search
          size={15}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[#71717a]"
        />
        <input
          type="text"
          placeholder="Search habits..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className={cn(
            "h-9 w-full rounded-lg pl-9 pr-3",
            "border border-white/4 bg-[#141416]/50",
            "text-sm text-[#e2e2e6] placeholder:text-[#71717a]",
            "focus:border-accent-habits/30 focus:outline-none focus:ring-1 focus:ring-accent-habits/50",
            "transition-all"
          )}
        />
      </div>
    </div>
  );
}

// ─── Today Progress bar ───────────────────────────────────────────────────────

function getMotivationConfig(pct: number): { icon: React.ReactNode; message: string } {
  if (pct === 0) return { icon: <Coffee size={16} />, message: "Start your day right" };
  if (pct <= 20) return { icon: <TrendingUp size={16} />, message: "Great start, keep going!" };
  if (pct <= 50) return { icon: <Flame size={16} />, message: "You're building momentum!" };
  if (pct <= 79) return { icon: <Zap size={16} />, message: "More than halfway there!" };
  if (pct <= 99) return { icon: <Trophy size={16} />, message: "Almost there, finish strong!" };
  return { icon: <Sparkles size={16} />, message: "All done today — legendary!" };
}

function TodayProgress({ completed, total }: { completed: number; total: number }) {
  const safeTotal = Math.max(total, 0);
  const pct = safeTotal > 0 ? Math.round((completed / safeTotal) * 100) : 0;
  const { icon, message } = getMotivationConfig(pct);

  return (
    <div className="overflow-hidden rounded-lg border border-white/4 bg-[#0e0e10]">
      <div className="flex items-stretch">
        <div className="flex-1 px-4 py-3">
          <p className="mb-2 text-sm font-semibold text-[#e2e2e6]">Today Progress</p>
          <div className="flex items-center gap-3">
            <div className="h-2 w-1/2 shrink-0 overflow-hidden rounded-full bg-[#1a1a1d]">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${pct}%`,
                  backgroundColor: ACCENT,
                  boxShadow: pct > 0 ? "0 0 8px #f43f5e60" : undefined,
                }}
              />
            </div>
            <span
              className="shrink-0 text-2xl font-bold"
              style={{ color: ACCENT }}
            >
              {pct}%
            </span>
            <span className="shrink-0 text-xs text-[#71717a]">
              {completed}/{safeTotal} habits completed
            </span>
          </div>
        </div>

        <div className="my-3 w-px bg-[#141416]" />

        <div className="flex w-44 items-center gap-2.5 px-4" style={{ color: ACCENT }}>
          <span className="shrink-0">{icon}</span>
          <span className="text-xs font-medium leading-relaxed text-[#a0a0a8]">
            {message}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function HabitsPage() {
  const [tab, setTab] = useState<HabitTab>("today");
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  const { data: allHabits = [], isLoading: habitsLoading } = useHabits();
  const {
    habits: todayHabits,
    recentCompletions,
    completedCount,
    totalCount,
    isLoading: todayLoading,
  } = useHabitsToday();

  const {
    mutate: completeHabit,
    isPending: completing,
    variables: completeVars,
  } = useCompleteHabit();

  const {
    mutate: uncompleteHabit,
    isPending: uncompleting,
    variables: uncompleteVars,
  } = useUncompleteHabit();

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const isLoading = habitsLoading || todayLoading;

  if (!isLoading && allHabits.length === 0) {
    return (
      <div className="flex min-h-full flex-col">
        <HabitsTopbar search={search} onSearchChange={setSearch} />
        <div className="flex flex-1 items-center justify-center">
          <HabitsEmptyState onCreateClick={() => setModalOpen(true)} />
        </div>
        <HabitModal open={modalOpen} onClose={() => setModalOpen(false)} />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-full flex-col">
        <HabitsTopbar search={search} onSearchChange={setSearch} />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto flex min-h-full flex-col">
      <HabitsTopbar search={search} onSearchChange={setSearch} />

      <div className="space-y-4 px-4 py-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold leading-tight text-[#e2e2e6]">Habits</h1>
            <p className="mt-0.5 text-sm text-[#71717a]">
              Build consistency. One day at a time.
            </p>
          </div>

          <Button
            onClick={() => setModalOpen(true)}
            style={{ backgroundColor: ACCENT }}
            className="h-8 shrink-0 px-3 text-sm font-medium text-white hover:opacity-90"
          >
            + New Habit
          </Button>
        </div>

        {totalCount > 0 && <TodayProgress completed={completedCount} total={totalCount} />}

        <div className="flex items-center border-b border-white/4">
          {([
            { value: "today", label: "Today" },
            { value: "calendar", label: "Calendar" },
            { value: "all", label: "All Habits" },
          ] as const).map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              className={cn(
                "relative px-4 pb-2.5 pt-1 text-sm font-medium transition-colors",
                tab === value ? "text-[#e2e2e6]" : "text-[#71717a] hover:text-[#a0a0a8]"
              )}
            >
              {label}
              {tab === value && (
                <span
                  className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-sm"
                  style={{ backgroundColor: ACCENT }}
                />
              )}
            </button>
          ))}
        </div>

        {tab === "today" && (
          <div className="mt-4 flex gap-4">
            <div className="min-w-0 flex-13 space-y-3">
              {todayHabits.length === 0 ? (
                <p className="py-6 text-center text-sm text-[#71717a]">
                  No habits scheduled for today.
                </p>
              ) : (
                todayHabits.map((habit) => (
                  <HabitCard
                    key={habit.id}
                    habit={habit}
                    onComplete={(id) =>
                      completeHabit({ habit_id: id, completed_date: todayStr })
                    }
                    onUncomplete={(id) =>
                      uncompleteHabit({ habitId: id, date: todayStr })
                    }
                    isPending={
                      (completing && completeVars?.habit_id === habit.id) ||
                      (uncompleting && uncompleteVars?.habitId === habit.id)
                    }
                  />
                ))
              )}
            </div>

            <div className="min-w-0 flex-7">
              <HabitsRightPanel
                habits={todayHabits}
                recentCompletions={recentCompletions}
              />
            </div>
          </div>
        )}

        {tab === "calendar" && (
          <div className="mt-4">
            <HabitsCalendarView />
          </div>
        )}

        {tab === "all" && (
          <div className="mt-4">
            <AllHabitsHeatmap />
          </div>
        )}
      </div>

      <HabitModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
