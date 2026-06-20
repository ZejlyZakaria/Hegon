"use client";

import { useState, useEffect, useMemo, startTransition } from "react";
import { useCommandCenter } from "@/modules/command-center/store";
import { Search, Plus } from "lucide-react";
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
import { TabNav } from "@/shared/components/ui/tab-nav";
import { StaggerList, StaggerItem, FadeIn } from "@/shared/components/ui/motion";
import { LifeLayout } from "@/shared/components/layout/LifeLayout";
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

  // Search + filters — rendered on the tab row (desktop) OR a second row (mobile).
  const filtersBlock = (
    <>
      <div className="relative flex flex-1 items-center sm:w-48 sm:flex-none">
        <Search size={14} className="pointer-events-none absolute left-2.5 text-text-tertiary" />
        <Input
          variant="tasks"
          placeholder="Search goals…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 w-full bg-surface-2 py-0 pl-8 text-xs hover:bg-surface-3 border-border-subtle focus:border-border-focus"
        />
      </div>
      <Select value={category} onValueChange={(v) => setCategory(v as GoalCategory | "all")}>
        <SelectTrigger variant="tasks" className="h-9 w-32 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent variant="tasks">
          {CATEGORIES.map((c) => (<SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>))}
        </SelectContent>
      </Select>
      <Select value={sort} onValueChange={(v) => setSort(v as GoalSort)}>
        <SelectTrigger variant="tasks" className="h-9 w-28 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent variant="tasks">
          {SORTS.map((s) => (<SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>))}
        </SelectContent>
      </Select>
    </>
  );

  return (
    <div className="flex min-h-full flex-col">
      {isLoading ? (
        <GoalsLoadingSkeleton />
      ) : (
        <>
          {/* ── Full-width toolbar rail — tabs + filters, flush under the TopBar.
               The breadcrumb ("Life / Goals") names the page, so no H1. ── */}
          {goals.length > 0 && (
            <FadeIn y={-6} className="border-b border-border-subtle px-4 sm:px-6">
              {/* Row 1 — tabs + action (mobile: icon-only "+" at right ; desktop: filters + full button) */}
              <div className="flex items-center gap-x-3">
                <TabNav
                  accent={ACCENT}
                  activeKey={tab}
                  items={TABS.map((t) => ({ key: t.value, label: t.label, onClick: () => setTab(t.value) }))}
                />

                <div className="ml-auto flex items-center gap-2 pb-1.5">
                  {view === "list" && (
                    <div className="hidden items-center gap-2 sm:flex">{filtersBlock}</div>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(true)}
                    aria-label="New goal"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control text-sm font-medium text-white transition-opacity hover:opacity-90 sm:w-auto sm:px-3 sm:whitespace-nowrap"
                    style={{ backgroundColor: "var(--color-accent-goals)" }}
                  >
                    <Plus size={16} className="sm:hidden" />
                    <span className="hidden sm:inline">+ New Goal</span>
                  </button>
                </div>
              </div>

              {/* Row 2 (mobile only) — search + filters */}
              {view === "list" && (
                <div className="mt-1.5 flex items-center gap-2 pb-2 sm:hidden">{filtersBlock}</div>
              )}
            </FadeIn>
          )}

          {/* Content */}
          <div className="px-4 py-4 sm:px-6 sm:py-6">
            {goals.length === 0 ? (
              <GoalsEmptyState onCreateClick={() => setIsModalOpen(true)} />
            ) : view === "timeline" ? (
              <GoalsRoadmap goals={goals} />
            ) : view === "reviews" ? (
              <ReviewsView />
            ) : (
              <LifeLayout
                right={
                  <GoalRightPanel
                    goals={goals}
                    activeCategory={activeCategory}
                    onCategoryClick={handleCompassClick}
                  />
                }
              >
                {displayed.length === 0 ? (
                  <p className="py-16 text-center text-sm text-text-tertiary">
                    No goals match this filter.
                  </p>
                ) : (
                  <StaggerList className="space-y-3">
                    {displayed.map((goal, i) => (
                      <StaggerItem key={goal.id} index={i}>
                        <GoalCard goal={goal} />
                      </StaggerItem>
                    ))}
                  </StaggerList>
                )}
              </LifeLayout>
            )}
          </div>
        </>
      )}

      <GoalPanel open={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
}
