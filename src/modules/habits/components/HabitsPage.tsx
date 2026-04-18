"use client";

import { useState } from "react";
import { Search, AlertTriangle, Check, Circle, Coffee, TrendingUp, Flame, Zap, Trophy, Sparkles } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/utils/utils";
import { useHabits } from "../hooks/useHabits";
import { useHabitsToday, useCompleteHabit, useUncompleteHabit } from "../hooks/useHabitsToday";
import { HabitsEmptyState } from "./HabitsEmptyState";
import { HabitCard } from "./HabitCard";
import { HabitModal } from "./HabitModal";
import { HabitsRightPanel } from "./HabitsRightPanel";
import { HabitsCalendarView } from "./HabitsCalendarView";
import { AllHabitsHeatmap } from "./AllHabitsHeatmap";
import type { HabitTab } from "../types";

const ACCENT = "#f43f5e";

// ─── Topbar ───────────────────────────────────────────────────────────────────

function HabitsTopbar({
  search,
  onSearchChange,
  onNewHabit,
}: {
  search: string;
  onSearchChange: (v: string) => void;
  onNewHabit: () => void;
}) {
  return (
    <div className="h-14 border-b border-white/5 bg-zinc-950/80 backdrop-blur-sm flex items-center justify-between px-4 gap-4 sticky top-0 z-10">
      <div className="relative flex-1 max-w-xs">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
        <input
          type="text"
          placeholder="Search habits..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className={cn(
            "w-full h-9 pl-9 pr-3 rounded-lg",
            "bg-zinc-900/50 border border-white/5",
            "text-zinc-100 text-sm placeholder:text-zinc-600",
            "focus:outline-none focus:ring-1 focus:ring-[#f43f5e]/50 focus:border-[#f43f5e]/30",
            "transition-all",
          )}
        />
      </div>
      <Button
        onClick={onNewHabit}
        style={{ backgroundColor: ACCENT }}
        className="text-white hover:opacity-90 shrink-0"
      >
        + New Habit
      </Button>
    </div>
  );
}

// ─── Right badge (top-right of header) ───────────────────────────────────────

function HeaderBadge({
  icon,
  count,
  label,
  color,
}: {
  icon:  React.ReactNode;
  count: number;
  label: string;
  color: string;
}) {
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-900/80 border border-zinc-800/60">
      <span style={{ color }}>{icon}</span>
      <span className="text-xs font-medium text-zinc-400">
        <span className="text-zinc-200 font-semibold">{count}</span> {label}
      </span>
    </div>
  );
}

// ─── Today Progress bar ───────────────────────────────────────────────────────

function getMotivationConfig(pct: number): { icon: React.ReactNode; message: string } {
  if (pct === 0)        return { icon: <Coffee   size={16} />, message: "Start your day right"         };
  if (pct <= 20)        return { icon: <TrendingUp size={16} />, message: "Great start, keep going!"   };
  if (pct <= 50)        return { icon: <Flame     size={16} />, message: "You're building momentum!"   };
  if (pct <= 79)        return { icon: <Zap       size={16} />, message: "More than halfway there!"    };
  if (pct <= 99)        return { icon: <Trophy    size={16} />, message: "Almost there, finish strong!" };
  return                       { icon: <Sparkles  size={16} />, message: "All done today — legendary!" };
}

function TodayProgress({ completed, total }: { completed: number; total: number }) {
  const pct    = Math.round((completed / total) * 100);
  const { icon, message } = getMotivationConfig(pct);

  return (
    <div className="flex items-stretch rounded-xl bg-zinc-900/60 border border-zinc-800/60 overflow-hidden">

      {/* Left — progress */}
      <div className="flex-1 px-4 py-3">
        <p className="text-sm font-semibold text-zinc-200 mb-2">Today Progress</p>
        <div className="flex items-center gap-3">
          <div className="w-1/2 h-2 rounded-full bg-zinc-800 overflow-hidden shrink-0">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${pct}%`,
                backgroundColor: ACCENT,
                boxShadow: pct > 0 ? `0 0 8px ${ACCENT}60` : undefined,
              }}
            />
          </div>
          <span className="text-2xl font-bold shrink-0" style={{ color: ACCENT }}>{pct}%</span>
          <span className="text-xs text-zinc-500 shrink-0">{completed}/{total} habits completed</span>
        </div>
      </div>

      {/* Divider — with vertical padding so it doesn't touch top/bottom */}
      <div className="w-px bg-zinc-800/60 my-3" />

      {/* Right — motivation, fixed width so text wraps */}
      <div className="flex items-center gap-2.5 px-4 w-44" style={{ color: ACCENT }}>
        <span className="shrink-0">{icon}</span>
        <span className="text-xs font-medium text-zinc-400 leading-relaxed">{message}</span>
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
    habits:            todayHabits,
    recentCompletions,
    completedCount,
    totalCount,
    isLoading:         todayLoading,
  } = useHabitsToday();
  const { mutate: completeHabit,   isPending: completing,   variables: completeVars   } = useCompleteHabit();
  const { mutate: uncompleteHabit, isPending: uncompleting, variables: uncompleteVars } = useUncompleteHabit();

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  // Wait for both queries before deciding which UI to show
  const isLoading = habitsLoading || todayLoading;

  const atRiskCount  = todayHabits.filter((h) => h.at_risk).length;
  const activeCount  = allHabits.length;

  // ── Empty state — topbar only, no header, no stats ────────────────────────
  if (!isLoading && allHabits.length === 0) {
    return (
      <div className="flex flex-col min-h-full">
        <HabitsTopbar search={search} onSearchChange={setSearch} onNewHabit={() => setModalOpen(true)} />
        <div className="flex-1 flex items-center justify-center">
          <HabitsEmptyState onCreateClick={() => setModalOpen(true)} />
        </div>
        <HabitModal open={modalOpen} onClose={() => setModalOpen(false)} />
      </div>
    );
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex flex-col min-h-full">
        <HabitsTopbar search={search} onSearchChange={setSearch} onNewHabit={() => setModalOpen(true)} />
      </div>
    );
  }

  // ── Full UI ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col min-h-full">
      <HabitsTopbar search={search} onSearchChange={setSearch} onNewHabit={() => setModalOpen(true)} />

      <div className="px-4 py-5 space-y-4">

        {/* Module header */}
        <div className="flex items-start justify-between gap-4">
          {/* Left: title + subtitle + inline stats */}
          <div>
            <h1 className="text-xl font-bold text-zinc-200 leading-tight">Habits</h1>
            <p className="text-sm text-zinc-500 mt-0.5">Build consistency. One day at a time.</p>
            <p className="text-xs text-zinc-500 mt-1.5">
              <span className="text-zinc-300 font-medium">{totalCount - completedCount}</span>
              {" "}en mouvement
              <span className="mx-2 text-zinc-700">•</span>
              <span className="text-amber-400 font-medium">{atRiskCount}</span>
              {" "}en retard
              <span className="mx-2 text-zinc-700">•</span>
              <span style={{ color: ACCENT }} className="font-medium">{completedCount}</span>
              {" "}à célébrer
            </p>
          </div>

          {/* Right: summary badges */}
          <div className="flex items-center gap-2 shrink-0 mt-0.5">
            <HeaderBadge
              icon={<Circle size={8} fill="currentColor" />}
              count={activeCount}
              label="Active"
              color="#10b981"
            />
            <HeaderBadge
              icon={<AlertTriangle size={11} />}
              count={atRiskCount}
              label="At Risk"
              color="#f59e0b"
            />
            <HeaderBadge
              icon={<Check size={11} />}
              count={completedCount}
              label="Completed"
              color={ACCENT}
            />
          </div>
        </div>

        {/* Today Progress — only when there are habits expected today */}
        {tab === "today" && totalCount > 0 && (
          <TodayProgress completed={completedCount} total={totalCount} />
        )}

        {/* ── Tab nav — underline style, full-width indicator ── */}
        <div className="flex items-center border-b border-zinc-800/50">
          {([
            { value: "today",    label: "Today"      },
            { value: "calendar", label: "Calendar"   },
            { value: "all",      label: "All Habits" },
          ] as const).map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              className={cn(
                "relative px-4 pb-2.5 pt-1 text-sm font-medium transition-colors",
                tab === value
                  ? "text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-300",
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

        {/* ── Today ── */}
        {tab === "today" && (
          <div className="mt-4 flex gap-4">
            {/* Left: habit list — 65% */}
            <div className="flex-13 min-w-0 space-y-3">
              {todayHabits.length === 0 ? (
                <p className="text-sm text-zinc-600 py-6 text-center">
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
                      (completing   && completeVars?.habit_id === habit.id) ||
                      (uncompleting && uncompleteVars?.habitId === habit.id)
                    }
                  />
                ))
              )}
            </div>

            {/* Right: Weekly Rhythm + Quick Stats + Heatmap — 35% */}
            <div className="flex-7 min-w-0">
              <HabitsRightPanel
                habits={todayHabits}
                recentCompletions={recentCompletions}
              />
            </div>
          </div>
        )}

        {/* ── Calendar ── */}
        {tab === "calendar" && (
          <div className="mt-4">
            <HabitsCalendarView />
          </div>
        )}

        {/* ── All Habits ── */}
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
