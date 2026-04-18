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
import { GoalFocusPanel } from "./GoalFocusPanel";
import { useGoals } from "../hooks/useGoals";
import type { Goal, GoalFilter, GoalSort, GoalCategory } from "../types";

const ACCENT = "#18ad9d";

const FILTERS: { value: GoalFilter; label: string }[] = [
  { value: "all",       label: "All" },
  { value: "active",    label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "personal",  label: "Personal" },
  { value: "work",      label: "Work" },
  { value: "health",    label: "Health" },
  { value: "learning",  label: "Learning" },
  { value: "finance",   label: "Finance" },
];

const SORTS: { value: GoalSort; label: string }[] = [
  { value: "deadline",  label: "Deadline" },
  { value: "progress",  label: "Progress" },
  { value: "priority",  label: "Priority" },
  { value: "created",   label: "Created" },
];

const PRIORITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

function filterAndSort(goals: Goal[], filter: GoalFilter, sort: GoalSort): Goal[] {
  let result = goals.filter((g) => g.status !== "abandoned");

  if (filter === "active" || filter === "completed") {
    result = result.filter((g) => g.status === filter);
  } else if (filter !== "all") {
    result = result.filter((g) => g.category === filter);
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

export function GoalGrid() {
  const { data: goals = [], isLoading } = useGoals();

  const [filter,         setFilter]         = useState<GoalFilter>("all");
  const [sort,           setSort]           = useState<GoalSort>("deadline");
  const [isModalOpen,    setIsModalOpen]    = useState(false);
  const [activeCategory, setActiveCategory] = useState<GoalCategory | null>(null);

  function handleCompassClick(cat: GoalCategory | null) {
    setActiveCategory(cat);
    setFilter(cat ?? "all");
  }

  const displayed = filterAndSort(
    activeCategory ? goals.filter((g) => g.category === activeCategory) : goals,
    filter,
    sort
  );

  return (
    <>
      {/* ── Topbar ── */}
      <div className="h-14 border-b border-white/5 bg-zinc-950/50 backdrop-blur-sm flex items-center justify-between px-4 gap-4 shrink-0">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            className="w-full h-9 pl-9 pr-3 rounded-lg bg-zinc-900/50 border border-white/5 text-zinc-100 text-sm placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-[#18ad9d] focus:border-[#18ad9d] transition-all"
            placeholder="Search goals…"
          />
        </div>
        <Button
          type="button"
          onClick={() => setIsModalOpen(true)}
          style={{ backgroundColor: ACCENT }}
          className="text-white hover:opacity-90 shrink-0"
        >
          + New Goal
        </Button>
      </div>

      {/* ── Content ── */}
      <div className="px-4 py-3 max-w-7xl mx-auto">
        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-40 rounded-2xl bg-zinc-900/80 animate-pulse" />
            ))}
          </div>
        ) : goals.length === 0 ? (
          <GoalsEmptyState onCreateClick={() => setIsModalOpen(true)} />
        ) : (
          <div className="flex gap-6 items-start">

            {/* Left — filters + grid */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
                <div className="flex items-center gap-1 flex-wrap">
                  {FILTERS.map((f) => (
                    <button
                      key={f.value}
                      type="button"
                      onClick={() => { setFilter(f.value); setActiveCategory(null); }}
                      className={cn(
                        "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
                        filter === f.value
                          ? "border"
                          : "text-zinc-500 hover:text-zinc-300"
                      )}
                      style={
                        filter === f.value
                          ? { backgroundColor: `${ACCENT}20`, borderColor: `${ACCENT}40`, color: ACCENT }
                          : undefined
                      }
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                <Select value={sort} onValueChange={(v) => setSort(v as GoalSort)}>
                  <SelectTrigger variant="tasks" className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent variant="tasks">
                    {SORTS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {displayed.length === 0 ? (
                <div className="py-16 text-center text-sm text-zinc-600">
                  No goals match this filter.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                  {displayed.map((goal) => (
                    <GoalCard key={goal.id} goal={goal} />
                  ))}
                </div>
              )}
            </div>

            {/* Right panel — xl+ only, sticky */}
            <div className="hidden xl:block w-72 shrink-0 sticky top-6">
              <GoalFocusPanel
                goals={goals}
                activeCategory={activeCategory}
                onCategoryClick={handleCompassClick}
              />
            </div>
          </div>
        )}
      </div>

      <GoalModal open={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
}
