"use client";

import { useState, useEffect, startTransition } from "react";
import { motion } from "framer-motion";
import { useCommandCenter } from "@/modules/command-center/store";
import { SearchInput } from "@/shared/components/ui/search-input";
import { Pause, ChevronRight } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/utils/utils";
import { resolveIcon } from "@/shared/constants/icons";
import { useHabits, useDeleteHabit } from "../hooks/useHabits";
import {
  useHabitsToday,
  useCompleteHabit,
  useUncompleteHabit,
} from "../hooks/useHabitsToday";
import { useRealtimeHabits } from "../hooks/useRealtimeHabits";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import type { Habit } from "../types";
import { HabitsEmptyState } from "./HabitsEmptyState";
import { HabitsTodayTable } from "./HabitsTodayTable";
import { HabitModal } from "./HabitModal";
import { HabitsRightPanel } from "./HabitsRightPanel";
import { HabitsCalendarView } from "./HabitsCalendarView";
import { HabitsStats } from "./HabitsStats";
import { HabitsShowcase } from "./HabitsShowcase";
import { HabitDetailPanel } from "./HabitDetailPanel";
import { useHabitsUIStore } from "../store";
import { HabitsLoadingSkeleton } from "./HabitsSkeleton";
import type { HabitTab } from "../types";

const ACCENT = "var(--color-accent-habits-vivid)";
const ACCENT_DEEP = "var(--color-accent-habits)";

// ─── Main page ────────────────────────────────────────────────────────────────

export function HabitsPage() {
  const [tab, setTab] = useState<HabitTab>("today");
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [deletingHabit, setDeletingHabit] = useState<Habit | null>(null);

  const today    = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const deleteHabit = useDeleteHabit();
  const openPanel = useHabitsUIStore((s) => s.openPanel);
  useRealtimeHabits();
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
    pausedHabits,
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

  const isLoading = habitsLoading || todayLoading;

  const pendingId =
    (completing && completeVars?.habit_id) ||
    (uncompleting && uncompleteVars?.habitId) ||
    null;

  const filteredTodayHabits = search.trim()
    ? todayHabits.filter((h) => h.title.toLowerCase().includes(search.toLowerCase()))
    : todayHabits;

  if (isLoading) return <HabitsLoadingSkeleton />;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="flex min-h-full flex-col px-6 py-6 space-y-4"
    >
      {allHabits.length === 0 && (
        <>
          <HabitsEmptyState onCreateClick={() => setModalOpen(true)} />
          <HabitModal open={modalOpen} onClose={() => setModalOpen(false)} />
        </>
      )}

      {allHabits.length > 0 && (
        <>
          {/* Main layout: persistent rail + center + right panel */}
          <div className="flex gap-6 items-start">
            {/* Persistent showcase rail — watch + today ring + streak + unlock */}
            <div className="hidden lg:block w-56 shrink-0 sticky top-0 self-start">
              <HabitsShowcase
                habits={todayHabits}
                completed={completedCount}
                total={totalCount}
              />
            </div>

            {/* Center column */}
            <div className="flex-1 min-w-0">
              {/* Tabs + search + new habit */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center">
                  {([
                    { value: "today",    label: "Today" },
                    { value: "calendar", label: "Calendar" },
                    { value: "all",      label: "Stats" },
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

                {/* Search + New Habit live on Today only — keeps the other tabs'
                    header clean and avoids the add-button shift. ⌘K adds from anywhere. */}
                {tab === "today" && (
                  <div className="flex items-center gap-2 pb-1">
                    <SearchInput
                      placeholder="Search habits…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      onClear={() => setSearch("")}
                      containerClassName="w-48"
                    />
                    <Button
                      onClick={() => setModalOpen(true)}
                      style={{ backgroundColor: ACCENT_DEEP }}
                      className="h-9 shrink-0 px-3 text-sm font-medium text-white hover:opacity-90"
                    >
                      + New Habit
                    </Button>
                  </div>
                )}
              </div>

              {/* Tab content */}
              <div className="mt-3 space-y-3">
                {tab === "today" && (
                  <>
                    {filteredTodayHabits.length === 0 ? (
                      <p className="py-6 text-center text-sm text-text-tertiary">
                        {search.trim()
                          ? "No habits match your search."
                          : "No habits scheduled for today."}
                      </p>
                    ) : (
                      <HabitsTodayTable
                        habits={filteredTodayHabits}
                        pendingId={pendingId}
                        onToggle={(h) =>
                          h.completed_today && h.completion_id
                            ? uncompleteHabit({ habitId: h.id, date: todayStr })
                            : completeHabit({ habit_id: h.id, completed_date: todayStr })
                        }
                        onOpen={(h) => openPanel(h.id)}
                        onEdit={(h) => openPanel(h.id)}
                        onDelete={(h) => setDeletingHabit(h)}
                      />
                    )}

                    {pausedHabits.length > 0 && (
                      <div className="mt-6">
                        <div className="mb-2 flex items-center gap-1.5 px-3">
                          <Pause size={11} className="text-text-tertiary" />
                          <p className="text-caption uppercase text-text-tertiary">
                            Paused
                          </p>
                          <span className="text-[10px] text-text-tertiary">
                            {pausedHabits.length}
                          </span>
                        </div>
                        <div className="space-y-1.5">
                          {pausedHabits.map((h) => {
                            const { icon: Icon, color } = resolveIcon(h.icon);
                            return (
                              <button
                                key={h.id}
                                type="button"
                                onClick={() => openPanel(h.id)}
                                className="group flex h-12 w-full items-center gap-3 rounded-lg border border-border-subtle bg-surface-1/60 px-3 text-left opacity-70 transition-[background-color,opacity] duration-150 ease-out hover:bg-surface-2 hover:opacity-100"
                              >
                                <div
                                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border-subtle bg-surface-2"
                                  style={{ color }}
                                >
                                  <Icon size={14} />
                                </div>
                                <span className="min-w-0 flex-1 truncate text-sm font-medium text-text-secondary">
                                  {h.title}
                                </span>
                                <span className="shrink-0 text-[11px] font-medium text-text-tertiary">
                                  Resume
                                </span>
                                <ChevronRight
                                  size={14}
                                  className="shrink-0 text-text-tertiary transition-transform duration-150 ease-out group-hover:translate-x-0.5"
                                />
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {tab === "calendar" && <HabitsCalendarView />}
                {tab === "all" && <HabitsStats />}
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
        </>
      )}

      <HabitModal open={modalOpen} onClose={() => setModalOpen(false)} />

      <Dialog open={!!deletingHabit} onOpenChange={(v) => !v && setDeletingHabit(null)}>
        <DialogContent className="sm:max-w-sm bg-surface-3 border-border-strong">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold text-text-primary">
              Delete habit
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-text-secondary">
            Delete{" "}
            <span className="font-medium text-text-primary">&quot;{deletingHabit?.title}&quot;</span>?
            {" "}All completion history will be lost.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setDeletingHabit(null)}
              className="h-8 px-3 border-border-default text-text-secondary hover:text-text-primary hover:bg-surface-2"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (deletingHabit) {
                  deleteHabit.mutate(deletingHabit.id);
                  setDeletingHabit(null);
                }
              }}
              disabled={deleteHabit.isPending}
              className="h-8 px-3 text-white hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: "#ef4444" }}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <HabitDetailPanel onDelete={(h) => setDeletingHabit(h)} />
    </motion.div>
  );
}
