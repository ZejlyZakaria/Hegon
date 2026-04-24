"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { cn } from "@/shared/utils/utils";
import { Button } from "@/shared/components/ui/button";
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
): Goal[] {
  let result = goals.filter((g) => g.status !== "abandoned");

  if (status === "active" || status === "completed") {
    result = result.filter((g) => g.status === status);
  }

  if (category !== "all") {
    result = result.filter((g) => g.category === category);
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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<GoalCategory | null>(null);

  function handleCompassClick(cat: GoalCategory | null) {
    setActiveCategory(cat);
    setCategory(cat ?? "all");
  }

  const displayed = filterAndSort(goals, status, category, sort);

  return (
    <div className="max-w-7xl mx-auto flex min-h-full flex-col">
      {/* ── Topbar ── */}
      <div className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b border-white/4 bg-[#09090b]/80 px-4 backdrop-blur-sm shrink-0">
        <div className="relative flex-1 max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#71717a]" />
          <input
            className="w-full h-8 pl-8 pr-3 rounded-md bg-[#141416] border border-white/[0.07] text-sm text-[#e2e2e6] placeholder:text-[#71717a] focus:outline-none focus:border-white/20 transition-colors"
            placeholder="Search goals…"
          />
        </div>
      </div>

      <div className="space-y-4 px-4 py-5">
        {/* ── Module header ── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold leading-tight text-[#e2e2e6]">Goals</h1>
            <p className="mt-0.5 text-sm text-[#71717a]">
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
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-14 rounded-lg bg-[#0e0e10] animate-pulse" />
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
              <div className="flex items-center justify-between border-b border-white/4">
                <div className="flex items-center">
                  {STATUS_TABS.map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setStatus(value)}
                      className={cn(
                        "relative px-4 pb-2.5 pt-1 text-sm font-medium transition-colors",
                        status === value ? "text-[#e2e2e6]" : "text-[#71717a] hover:text-[#a0a0a8]"
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
              <div className="mt-3 space-y-2">
                {displayed.length === 0 ? (
                  <p className="py-16 text-center text-sm text-[#71717a]">
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
            <div className="hidden xl:block w-72 shrink-0 sticky top-20">
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
