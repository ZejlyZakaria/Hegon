"use client";

import { useState, useEffect, startTransition } from "react";
import { motion } from "framer-motion";
import { FadeIn, StaggerList, StaggerItem } from "@/shared/components/ui/motion";
import { useCommandCenter } from "@/modules/command-center/store";
import { SearchInput } from "@/shared/components/ui/search-input";
import { TabNav } from "@/shared/components/ui/tab-nav";
import { Pause, ChevronRight, CalendarRange } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
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
import { DailyProgress } from "./DailyProgress";
import { HabitDetailPanel } from "./HabitDetailPanel";
import { useHabitsUIStore } from "../store";
import { HabitsLoadingSkeleton } from "./HabitsSkeleton";

const ACCENT = "var(--color-accent-habits-vivid)";

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
      className="flex min-h-full flex-col"
    >
      {!hasAnyHabit && (
        <div className="px-4 py-4 sm:px-6 sm:py-6">
          <HabitsEmptyState onCreateClick={() => setModalOpen(true)} />
          <HabitModal open={modalOpen} onClose={() => setModalOpen(false)} />
        </div>
      )}

      {hasAnyHabit && (
        <>
          {/* Full-width tab rail — flush under the TopBar, identical placement to
              every other module (Watching is the spacing reference). */}
          <div className="border-b border-border-subtle px-4 sm:px-6">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <TabNav
                accent={ACCENT}
                activeKey={tab}
                items={[
                  { key: "today",    label: "Today",    onClick: () => setTab("today") },
                  { key: "calendar", label: "Calendar", onClick: () => setTab("calendar") },
                  { key: "all",      label: "All",      onClick: () => setTab("all") },
                  { key: "stats",    label: "Stats",    onClick: () => setTab("stats") },
                ]}
              />

              {/* New Habit stays on every tab (anchors the row → no shift between
                  tabs, and lets you add from anywhere). Search is Today-only. */}
              <div className="ml-auto flex items-center gap-2 pb-1.5">
                {tab === "today" && (
                  <SearchInput
                    placeholder="Search habits…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onClear={() => setSearch("")}
                    containerClassName="flex-1 sm:w-48"
                  />
                )}
                <Button variant="legacy"
                  onClick={() => setModalOpen(true)}
                  style={{ backgroundColor: ACCENT }}
                  className="h-9 shrink-0 px-3 text-sm font-medium text-white hover:opacity-90"
                >
                  + New Habit
                </Button>
              </div>
            </div>
          </div>

          {/* Content — persistent showcase rail + center + right panel */}
          <div className="px-4 py-4 sm:px-6 sm:py-6">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
            {/* Showcase rail — watch + face collection + unlock. Hidden on Stats
                (Stats is its own full-width dashboard; the watch would be noise). */}
            {tab !== "stats" && (
              <FadeIn className="hidden lg:block w-56 shrink-0 sticky top-0 self-start">
                <HabitsShowcase habits={todayHabits} />
              </FadeIn>
            )}

            {/* Center column */}
            <div className="flex-1 min-w-0">
              {/* Tab content */}
              <div className="space-y-3">
                {tab === "today" && (
                  <>
                    <DailyProgress completed={completedCount} total={totalCount} />

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
                          <p className="text-xs font-semibold text-text-secondary">
                            This Week
                          </p>
                          <span className="text-[10px] text-text-tertiary">
                            {filteredWeeklyHabits.filter((h) => h.completed_today).length}/{filteredWeeklyHabits.length}
                          </span>
                        </div>
                        <StaggerList className="space-y-2">
                          {filteredWeeklyHabits.map((h, i) => (
                            <StaggerItem key={h.id} index={i}>
                              <HabitRow
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
                            </StaggerItem>
                          ))}
                        </StaggerList>
                      </div>
                    )}

                    {pausedHabits.length > 0 && (
                      <div className="mt-6">
                        <div className="mb-2 flex items-center gap-1.5 px-3">
                          <Pause size={11} className="text-text-tertiary" />
                          <p className="text-xs font-semibold text-text-secondary">
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
                                className="group flex h-12 w-full items-center gap-3 rounded-card surface-card px-3 text-left opacity-70 transition-[background-color,opacity] duration-150 ease-out hover:bg-surface-2 hover:opacity-100"
                              >
                                <div
                                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-tile border border-border-subtle bg-surface-2"
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

                {tab === "calendar" && (
                  <FadeIn key="calendar">
                    <HabitsCalendarView />
                  </FadeIn>
                )}
                {tab === "stats" && (
                  <FadeIn key="stats">
                    <HabitsStats />
                  </FadeIn>
                )}
                {tab === "all" && (
                  <FadeIn key="all">
                    <HabitsAllView onDelete={(h) => setDeletingHabit(h)} />
                  </FadeIn>
                )}
              </div>
            </div>

            {/* Right panel — Today tab only */}
            {tab === "today" && (
              <FadeIn className="w-full lg:w-72 lg:shrink-0">
                <HabitsRightPanel
                  habits={todayHabits}
                  recentCompletions={recentCompletions}
                />
              </FadeIn>
            )}
            </div>
          </div>
        </>
      )}

      <HabitModal open={modalOpen} onClose={() => setModalOpen(false)} />

      <Dialog open={!!deletingHabit} onOpenChange={(v) => !v && setDeletingHabit(null)}>
        <DialogContent className="sm:max-w-sm">
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
              <Button variant="legacy"
                onClick={() => {
                  if (deletingHabit) {
                    archiveHabit.mutate(deletingHabit.id);
                    setDeletingHabit(null);
                  }
                }}
                disabled={archiveHabit.isPending}
                style={{ backgroundColor: ACCENT }}
                className="h-9 w-full text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                Archive (keep history)
              </Button>
            )}
            <Button variant="legacy"
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
