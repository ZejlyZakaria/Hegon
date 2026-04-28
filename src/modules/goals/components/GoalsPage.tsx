"use client";

import { useState, useEffect, useMemo, startTransition } from "react";
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
import { GoalModal } from "./GoalModal";
import { GoalsEmptyState } from "./GoalsEmptyState";
import { GoalRightPanel } from "./GoalFocusPanel";
import { useGoals } from "../hooks/useGoals";
import type { Goal, GoalSort, GoalCategory } from "../types";

const ACCENT = "var(--color-accent-goals)";

const STATUS_TABS = [
  { value: "all",       label: "All" },
  { value: "active",    label: "Active" },
  { value: "completed", label: "Completed" },
] as const;

type StatusFilter = "all" | "active" | "completed";

const CATEGORIES: { value: GoalCategory | "all"; label: string }[] = [
  { value: "all",      label: "All categories" },
  { value: "personal", label: "Personal" },
  { value: "work",     label: "Work" },
  { value: "health",   label: "Health" },
  { value: "learning", label: "Learning" },
  { value: "finance",  label: "Finance" },
  { value: "other",    label: "Other" },
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

  const [status, setStatus]         = useState<StatusFilter>("all");
  const [category, setCategory]     = useState<GoalCategory | "all">("all");
  const [sort, setSort]             = useState<GoalSort>("deadline");
  const [search, setSearch]             = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<GoalCategory | null>(null);

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
    () => filterAndSort(goals, status, category, sort, search),
    [goals, status, category, sort, search],
  );

  return (
    <div className="max-w-7xl mx-auto flex min-h-full flex-col">
      {/* ── Topbar ── */}
      <div className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b border-white/4 bg-[#09090b]/80 px-4 backdrop-blur-sm shrink-0">
        <div className="relative flex-1 max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
          <Input
            variant="tasks"
            placeholder="Search goals…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-8 bg-surface-1 hover:bg-surface-2 border-border-subtle focus:border-border-focus"
          />
        </div>
      </div>

      <div className="space-y-4 px-4 py-5">
        {/* ── Module header ── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold leading-tight text-text-primary">Goals</h1>
            <p className="mt-0.5 text-sm text-text-tertiary">
              Big picture. Clear path.
            </p>
          </div>
          <Button
            type="button"
            onClick={() => setIsModalOpen(true)}
            style={{ backgroundColor: ACCENT }}
            className="h-8 shrink-0 px-3 text-sm font-medium text-white hover:opacity-90"
          >
            + New Goal
          </Button>
        </div>

        {/* ── Content ── */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-14 rounded-lg bg-surface-1 animate-pulse" />
            ))}
          </div>
        ) : goals.length === 0 ? (
          <div className="flex flex-1 items-center justify-center py-20">
            <GoalsEmptyState onCreateClick={() => setIsModalOpen(true)} />
          </div>
        ) : (
          <div className="flex gap-6 items-start">
            {/* Left — tabs + list */}
            <div className="flex-1 min-w-0">
              {/* Tabs row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  {STATUS_TABS.map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setStatus(value)}
                      className={cn(
                        "relative px-4 pb-2.5 pt-1 text-sm font-medium transition-colors",
                        status === value ? "text-text-primary" : "text-text-tertiary hover:text-text-secondary"
                      )}
                    >
                      {label}
                      {status === value && (
                        <span
                          className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-sm"
                          style={{ backgroundColor: ACCENT }}
                        />
                      )}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2 pb-1">
                  <Select value={category} onValueChange={(v) => setCategory(v as GoalCategory | "all")}>
                    <SelectTrigger variant="tasks" className="h-7 w-36 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent variant="tasks">
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={sort} onValueChange={(v) => setSort(v as GoalSort)}>
                    <SelectTrigger variant="tasks" className="h-7 w-28 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent variant="tasks">
                      {SORTS.map((s) => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* List */}
              <div className="mt-3 space-y-3">
                {displayed.length === 0 ? (
                  <p className="py-16 text-center text-sm text-text-tertiary">
                    No goals match this filter.
                  </p>
                ) : (
                  displayed.map((goal) => (
                    <GoalCard key={goal.id} goal={goal} />
                  ))
                )}
              </div>
            </div>

            {/* Right panel — xl+ only, sticky */}
            <div className="w-72 shrink-0">
              <GoalRightPanel
                goals={goals}
                activeCategory={activeCategory}
                onCategoryClick={handleCompassClick}
              />
            </div>
          </div>
        )}
      </div>

      <GoalModal open={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
}
