"use client";

import { useState, useEffect, startTransition } from "react";
import { motion } from "framer-motion";
import { useCommandCenter } from "@/modules/command-center/store";
import { SearchInput } from "@/shared/components/ui/search-input";
import { Pause, ChevronRight, CalendarRange } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/utils/utils";
import { resolveIcon } from "@/shared/constants/icons";
import { useHabits, useArchivedHabits, useArchiveHabit, useDeleteHabitPermanently } from "../hooks/useHabits";
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
import { HabitRow } from "./HabitRow";
import { HabitModal } from "./HabitModal";
import { HabitsRightPanel } from "./HabitsRightPanel";
import { HabitsCalendarView } from "./HabitsCalendarView";
import { HabitsStats } from "./HabitsStats";
import { HabitsAllView } from "./HabitsAllView";
import { HabitsShowcase } from "./HabitsShowcase";
import { HabitDetailPanel } from "./HabitDetailPanel";
import { useHabitsUIStore } from "../store";
import { HabitsLoadingSkeleton } from "./HabitsSkeleton";

const ACCENT = "var(--color-accent-habits-vivid)";
const ACCENT_DEEP = "var(--color-accent-habits)";

// ─── Main page ────────────────────────────────────────────────────────────────

export function HabitsPage() {
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [deletingHabit, setDeletingHabit] = useState<Habit | null>(null);

  const today    = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const archiveHabit = useArchiveHabit();
  const deleteHabitPermanently = useDeleteHabitPermanently();
  // Tab lives in the store so other surfaces (Stats "View all") can navigate here.
  const { activeTab: tab, setActiveTab: setTab, openPanel } = useHabitsUIStore();
  useRealtimeHabits();
  const { pendingAction, clearPendingAction } = useCommandCenter();
  useEffect(() => {
    if (pendingAction === "new-habit") {
      startTransition(() => setModalOpen(true));
      clearPendingAction();
    }
  }, [pendingAction, clearPendingAction]);

  const { data: allHabits = [], isLoading: habitsLoading } = useHabits();
  const { data: archivedHabits = [] } = useArchivedHabits();
  const hasAnyHabit = allHabits.length > 0 || archivedHabits.length > 0;
  const {
    habits: todayHabits,
    weeklyHabits,
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

  const filteredWeeklyHabits = search.trim()
    ? weeklyHabits.filter((h) => h.title.toLowerCase().includes(search.toLowerCase()))
    : weeklyHabits;

  if (isLoading) return <HabitsLoadingSkeleton />;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="flex min-h-full flex-col px-4 py-4 sm:px-6 sm:py-6 space-y-4"
    >
      {!hasAnyHabit && (
        <>
          <HabitsEmptyState onCreateClick={() => setModalOpen(true)} />
          <HabitModal open={modalOpen} onClose={() => setModalOpen(false)} />
        </>
      )}

      {hasAnyHabit && (
        <>
          {/* Main layout: persistent rail + center + right panel */}
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
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
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                <div className="flex items-center overflow-x-auto custom-scrollbar-hide">
                  {([
                    { value: "today",    label: "Today" },
                    { value: "calendar", label: "Calendar" },
                    { value: "stats",    label: "Stats" },
                    { value: "all",      label: "All" },
                  ] as const).map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setTab(value)}
                      className={cn(
                        "relative shrink-0 whitespace-nowrap px-4 pb-2.5 pt-1 text-sm font-medium transition-colors",
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

                {/* New Habit stays on every tab (anchors the row height → no shift
                    between tabs, and lets you add from anywhere). Search is Today-only. */}
                <div className="flex items-center gap-2 pb-1">
                  {tab === "today" && (
                    <SearchInput
                      placeholder="Search habits…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      onClear={() => setSearch("")}
                      containerClassName="flex-1 sm:w-48"
                    />
                  )}
                  <Button
                    onClick={() => setModalOpen(true)}
                    style={{ backgroundColor: ACCENT_DEEP }}
                    className="h-9 shrink-0 px-3 text-sm font-medium text-white hover:opacity-90"
                  >
                    + New Habit
                  </Button>
                </div>
              </div>

              {/* Tab content */}
              <div className="mt-3 space-y-3">
                {tab === "today" && (
                  <>
                    {filteredTodayHabits.length === 0 ? (
                      (search.trim() || filteredWeeklyHabits.length === 0) && (
                        <p className="py-6 text-center text-sm text-text-tertiary">
                          {search.trim()
                            ? "No habits match your search."
                            : "No habits scheduled for today."}
                        </p>
                      )
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

                    {filteredWeeklyHabits.length > 0 && (
                      <div className="mt-6">
                        <div className="mb-2 flex items-center gap-1.5 px-3">
                          <CalendarRange size={11} className="text-text-tertiary" />
                          <p className="text-caption uppercase text-text-tertiary">
                            This Week
                          </p>
                          <span className="text-[10px] text-text-tertiary">
                            {filteredWeeklyHabits.filter((h) => h.completed_today).length}/{filteredWeeklyHabits.length}
                          </span>
                        </div>
                        <div className="space-y-2">
                          {filteredWeeklyHabits.map((h) => (
                            <HabitRow
                              key={h.id}
                              habit={h}
                              isPending={pendingId === h.id}
                              onToggle={(hb) =>
                                hb.completed_today && hb.week_completion_date
                                  ? uncompleteHabit({ habitId: hb.id, date: hb.week_completion_date })
                                  : completeHabit({ habit_id: hb.id, completed_date: todayStr })
                              }
                              onOpen={(hb) => openPanel(hb.id)}
                              onEdit={() => openPanel(h.id)}
                              onDelete={() => setDeletingHabit(h)}
                            />
                          ))}
                        </div>
                      </div>
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
                {tab === "stats" && <HabitsStats />}
                {tab === "all" && (
                  <HabitsAllView onDelete={(h) => setDeletingHabit(h)} />
                )}
              </div>
            </div>

            {/* Right panel — Today tab only */}
            {tab === "today" && (
              <div className="w-full lg:w-72 lg:shrink-0">
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
              {deletingHabit?.archived ? "Delete habit" : "Remove habit"}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-text-secondary">
            {deletingHabit?.archived ? (
              <>
                Permanently delete{" "}
                <span className="font-medium text-text-primary">&quot;{deletingHabit?.title}&quot;</span>
                {" "}and all its history? This can&apos;t be undone.
              </>
            ) : (
              <>
                What do you want to do with{" "}
                <span className="font-medium text-text-primary">&quot;{deletingHabit?.title}&quot;</span>?
                {" "}Archiving keeps your streak and history; deleting is permanent.
              </>
            )}
          </p>
          <div className="flex flex-col gap-2 pt-2">
            {!deletingHabit?.archived && (
              <Button
                onClick={() => {
                  if (deletingHabit) {
                    archiveHabit.mutate(deletingHabit.id);
                    setDeletingHabit(null);
                  }
                }}
                disabled={archiveHabit.isPending}
                style={{ backgroundColor: ACCENT_DEEP }}
                className="h-9 w-full text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                Archive (keep history)
              </Button>
            )}
            <Button
              onClick={() => {
                if (deletingHabit) {
                  deleteHabitPermanently.mutate(deletingHabit.id);
                  setDeletingHabit(null);
                }
              }}
              disabled={deleteHabitPermanently.isPending}
              className="h-9 w-full text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: "#ef4444" }}
            >
              Delete permanently
            </Button>
            <Button
              variant="outline"
              onClick={() => setDeletingHabit(null)}
              className="h-9 w-full border-border-default text-text-secondary hover:bg-surface-2 hover:text-text-primary"
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <HabitDetailPanel onDelete={(h) => setDeletingHabit(h)} />
    </motion.div>
  );
}
