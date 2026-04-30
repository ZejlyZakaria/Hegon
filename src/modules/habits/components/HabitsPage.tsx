"use client";

import { useState, useEffect, startTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useCommandCenter } from "@/modules/command-center/store";
import { Input } from "@/shared/components/ui/input";
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
import { HabitsLoadingSkeleton } from "./HabitsSkeleton";
import type { HabitTab } from "../types";

const ACCENT = "var(--color-accent-habits)";

// ─── Today Progress ───────────────────────────────────────────────────────────

function getMotivationConfig(pct: number): { icon: React.ReactNode; message: string } {
  if (pct === 0)   return { icon: <Coffee size={16} />,    message: "Start your day right" };
  if (pct <= 20)   return { icon: <TrendingUp size={16} />, message: "Great start, keep going!" };
  if (pct <= 50)   return { icon: <Flame size={16} />,     message: "You're building momentum!" };
  if (pct <= 79)   return { icon: <Zap size={16} />,       message: "More than halfway there!" };
  if (pct <= 99)   return { icon: <Trophy size={16} />,    message: "Almost there, finish strong!" };
  return             { icon: <Sparkles size={16} />,   message: "All done today — legendary!" };
}

function TodayProgress({ completed, total }: { completed: number; total: number }) {
  const safeTotal = Math.max(total, 0);
  const pct = safeTotal > 0 ? Math.round((completed / safeTotal) * 100) : 0;
  const { icon, message } = getMotivationConfig(pct);

  return (
    <div className="overflow-hidden rounded-lg border border-border-subtle bg-surface-1">
      <div className="flex items-stretch">
        <div className="flex-1 px-4 py-3">
          <p className="mb-2 text-sm font-semibold text-text-primary">Today Progress</p>
          <div className="flex items-center gap-3">
            <div className="h-2 w-1/2 shrink-0 overflow-hidden rounded-full bg-surface-overlay">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${pct}%`,
                  backgroundColor: ACCENT,
                  boxShadow: pct > 0 ? "0 0 8px #f43f5e60" : undefined,
                }}
              />
            </div>
            <span className="shrink-0 text-2xl font-bold" style={{ color: ACCENT }}>
              {pct}%
            </span>
            <span className="shrink-0 text-xs text-text-tertiary">
              {completed}/{safeTotal} habits completed
            </span>
          </div>
        </div>

        <div className="my-3 w-px bg-surface-2" />

        <div className="flex w-44 items-center gap-2.5 px-4" style={{ color: ACCENT }}>
          <span className="shrink-0">{icon}</span>
          <span className="text-xs font-medium leading-relaxed text-text-secondary">
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

  const { pendingAction, clearPendingAction } = useCommandCenter();
  useEffect(() => {
    if (pendingAction === "new-habit") {
      startTransition(() => setModalOpen(true));
      clearPendingAction();
    }
  }, [pendingAction, clearPendingAction]);

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

  const filteredTodayHabits = search.trim()
    ? todayHabits.filter((h) => h.title.toLowerCase().includes(search.toLowerCase()))
    : todayHabits;

  if (isLoading) return <HabitsLoadingSkeleton />;

  if (allHabits.length === 0) {
    return (
      <div className="px-6 py-5 flex flex-1 items-center justify-center min-h-full">
        <HabitsEmptyState onCreateClick={() => setModalOpen(true)} />
        <HabitModal open={modalOpen} onClose={() => setModalOpen(false)} />
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col px-6 py-5 space-y-4">
      {/* Header */}
      <motion.div
        className="flex items-start justify-between gap-4"
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
      >
        <div>
          <h1 className="text-xl font-bold leading-tight text-text-primary">Habits</h1>
          <p className="mt-0.5 text-sm text-text-tertiary">
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
      </motion.div>

      {totalCount > 0 && <TodayProgress completed={completedCount} total={totalCount} />}

      {/* Main layout: left + right */}
      <div className="flex gap-6 items-start">
        {/* Left column */}
        <div className="flex-1 min-w-0">
          {/* Tabs row + search */}
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              {([
                { value: "today",    label: "Today" },
                { value: "calendar", label: "Calendar" },
                { value: "all",      label: "All Habits" },
              ] as const).map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTab(value)}
                  className={cn(
                    "relative px-4 pb-2.5 pt-1 text-sm font-medium transition-colors",
                    tab === value
                      ? "text-text-primary"
                      : "text-text-tertiary hover:text-text-secondary",
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

            <div className="relative flex items-center pb-1">
              <Search
                size={14}
                className="absolute left-2.5 text-text-tertiary pointer-events-none"
              />
              <Input
                variant="tasks"
                type="text"
                placeholder="Search habits…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 py-0 pl-8 w-48 text-xs bg-surface-1 hover:bg-surface-2 border-border-subtle focus:border-border-focus"
              />
            </div>
          </div>

          {/* Tab content */}
          <div className="mt-3 space-y-3">
            {tab === "today" && (
              filteredTodayHabits.length === 0 ? (
                <p className="py-6 text-center text-sm text-text-tertiary">
                  {search.trim()
                    ? "No habits match your search."
                    : "No habits scheduled for today."}
                </p>
              ) : (
                <AnimatePresence mode="popLayout">
                  {filteredTodayHabits.map((habit, i) => (
                    <motion.div
                      key={habit.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.18, delay: i * 0.04, ease: "easeOut" }}
                    >
                      <HabitCard
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
                    </motion.div>
                  ))}
                </AnimatePresence>
              )
            )}

            {tab === "calendar" && <HabitsCalendarView />}
            {tab === "all" && <AllHabitsHeatmap />}
          </div>
        </div>

        {/* Right panel — Today tab only */}
        {tab === "today" && (
          <div className="w-72 shrink-0">
            <HabitsRightPanel
              habits={todayHabits}
              recentCompletions={recentCompletions}
            />
          </div>
        )}
      </div>

      <HabitModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
