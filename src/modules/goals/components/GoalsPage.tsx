"use client";

import { useState, useEffect, useMemo, startTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useCommandCenter } from "@/modules/command-center/store";
import { Search } from "lucide-react";
import { cn } from "@/shared/utils/utils";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { GoalCard } from "./GoalCard";
import { GoalPanel } from "./GoalPanel";
import { GoalsEmptyState } from "./GoalsEmptyState";
import { GoalsRoadmap } from "./GoalsRoadmap";
import { ReviewsView } from "./ReviewsView";
import { GoalRightPanel } from "./GoalFocusPanel";
import { GoalsLoadingSkeleton } from "./GoalsSkeleton";
import { useGoals } from "../hooks/useGoals";
import { useRealtimeGoals } from "../hooks/useRealtimeGoals";
import type { Goal, GoalSort, GoalCategory } from "../types";

const ACCENT = "var(--color-accent-goals)";

// One tab bar: the list filters (All/Active/Completed) and the alternate views
// (Timeline/Reviews) are the same control — "List" is implied by All/Active/Completed.
const TABS = [
  { value: "all",       label: "All" },
  { value: "active",    label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "timeline",  label: "Timeline" },
  { value: "reviews",   label: "Reviews" },
] as const;

type Tab = "all" | "active" | "completed" | "timeline" | "reviews";
type StatusFilter = "all" | "active" | "completed";

const CATEGORIES: { value: GoalCategory | "all"; label: string }[] = [
  { value: "all",       label: "All categories" },
  { value: "career",    label: "Career" },
  { value: "health",    label: "Health" },
  { value: "finance",   label: "Finance" },
  { value: "growth",    label: "Growth" },
  { value: "lifestyle", label: "Lifestyle" },
  { value: "other",     label: "Other" },
];

const SORTS: { value: GoalSort; label: string }[] = [
  { value: "deadline", label: "Deadline" },
  { value: "progress", label: "Progress" },
  { value: "priority", label: "Priority" },
  { value: "created", label: "Created" },
];

const PRIORITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

function filterAndSort(
  goals: Goal[],
  status: StatusFilter,
  category: GoalCategory | "all",
  sort: GoalSort,
  search: string,
): Goal[] {
  let result = goals.filter((g) => g.status !== "abandoned");

  if (status === "active" || status === "completed") {
    result = result.filter((g) => g.status === status);
  }

  if (category !== "all") {
    result = result.filter((g) => g.category === category);
  }

  if (search.trim()) {
    const q = search.toLowerCase();
    result = result.filter(
      (g) =>
        g.title.toLowerCase().includes(q) ||
        (g.description ?? "").toLowerCase().includes(q),
    );
  }

  return [...result].sort((a, b) => {
    switch (sort) {
      case "deadline":
        if (!a.target_date && !b.target_date) return 0;
        if (!a.target_date) return 1;
        if (!b.target_date) return -1;
        return a.target_date.localeCompare(b.target_date);
      case "progress":
        return b.progress - a.progress;
      case "priority":
        return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
      case "created":
        return b.created_at.localeCompare(a.created_at);
    }
  });
}

export function GoalsPage() {
  const { data: goals = [], isLoading } = useGoals();
  useRealtimeGoals();

  const [tab, setTab]               = useState<Tab>("all");
  const [category, setCategory]     = useState<GoalCategory | "all">("all");
  const [sort, setSort]             = useState<GoalSort>("deadline");
  const [search, setSearch]         = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<GoalCategory | null>(null);

  // The tab drives both the view mode and (for list tabs) the status filter.
  const view: "list" | "timeline" | "reviews" =
    tab === "timeline" ? "timeline" : tab === "reviews" ? "reviews" : "list";
  const statusFilter: StatusFilter = tab === "active" || tab === "completed" ? tab : "all";

  const { pendingAction, clearPendingAction } = useCommandCenter();
  useEffect(() => {
    if (pendingAction === "new-goal") {
      startTransition(() => setIsModalOpen(true));
      clearPendingAction();
    }
  }, [pendingAction, clearPendingAction]);

  function handleCompassClick(cat: GoalCategory | null) {
    setActiveCategory(cat);
    setCategory(cat ?? "all");
  }

  const displayed = useMemo(
    () => filterAndSort(goals, statusFilter, category, sort, search),
    [goals, statusFilter, category, sort, search],
  );

  return (
    <div className="flex min-h-full flex-col">
      <div className="space-y-4 px-4 py-4 sm:px-6 sm:py-6">
        {isLoading ? (
          <GoalsLoadingSkeleton />
        ) : (
          <>
            {/* ── Unified toolbar — replaces the page title; the TopBar breadcrumb
                 ("Life / Goals") already names the page, so the H1 was redundant. ── */}
            {goals.length > 0 && (
              <motion.div
                className="flex flex-wrap items-center gap-x-3 gap-y-2"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
              >
                {/* Unified tab bar — list filters (All/Active/Completed) and the
                    alternate views (Timeline/Reviews) are one control. */}
                <div className="flex items-center overflow-x-auto custom-scrollbar-hide">
                  {TABS.map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setTab(value)}
                      className={cn(
                        "relative shrink-0 whitespace-nowrap px-3 pb-2 pt-1 text-sm font-medium transition-colors",
                        tab === value ? "text-text-primary" : "text-text-tertiary hover:text-text-secondary",
                      )}
                    >
                      {label}
                      {tab === value && (
                        <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-sm" style={{ backgroundColor: ACCENT }} />
                      )}
                    </button>
                  ))}
                </div>

                {/* Right cluster — filters + action */}
                <div className="ml-auto flex flex-wrap items-center gap-2">
                  {view === "list" && (
                    <>
                      <div className="relative flex w-40 items-center sm:w-48">
                        <Search size={14} className="pointer-events-none absolute left-2.5 text-text-tertiary" />
                        <Input
                          variant="tasks"
                          placeholder="Search goals…"
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          className="h-8 w-full bg-surface-1 py-0 pl-8 text-xs hover:bg-surface-2 border-border-subtle focus:border-border-focus"
                        />
                      </div>
                      <Select value={category} onValueChange={(v) => setCategory(v as GoalCategory | "all")}>
                        <SelectTrigger variant="tasks" className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent variant="tasks">
                          {CATEGORIES.map((c) => (<SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>))}
                        </SelectContent>
                      </Select>
                      <Select value={sort} onValueChange={(v) => setSort(v as GoalSort)}>
                        <SelectTrigger variant="tasks" className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent variant="tasks">
                          {SORTS.map((s) => (<SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </>
                  )}

                  <Button
                    type="button"
                    onClick={() => setIsModalOpen(true)}
                    style={{ backgroundColor: "var(--color-accent-goals-deep)" }}
                    className="h-8 shrink-0 px-3 text-sm font-medium text-white hover:opacity-90"
                  >
                    + New Goal
                  </Button>
                </div>
              </motion.div>
            )}

            {goals.length === 0 ? (
              <GoalsEmptyState onCreateClick={() => setIsModalOpen(true)} />
            ) : view === "timeline" ? (
              <GoalsRoadmap goals={goals} />
            ) : view === "reviews" ? (
              <ReviewsView />
            ) : (
              <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
                {/* Left — list */}
                <div className="flex-1 min-w-0">
                  {/* List */}
                  <div className="space-y-3">
                    {displayed.length === 0 ? (
                      <p className="py-16 text-center text-sm text-text-tertiary">
                        No goals match this filter.
                      </p>
                    ) : (
                      <AnimatePresence mode="popLayout">
                        {displayed.map((goal, i) => (
                          <motion.div
                            key={goal.id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            transition={{ duration: 0.18, delay: i * 0.04, ease: "easeOut" }}
                          >
                            <GoalCard goal={goal} />
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    )}
                  </div>
                </div>

                {/* Right panel */}
                <div className="w-full lg:w-72 lg:shrink-0">
                  <GoalRightPanel
                    goals={goals}
                    activeCategory={activeCategory}
                    onCategoryClick={handleCompassClick}
                  />
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <GoalPanel open={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
}
