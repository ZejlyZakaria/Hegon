// =====================================================
// TASKS LOADING — Kanban gets a layout skeleton; every other
// view (and the pre-hydration moment) gets a centered spinner.
// =====================================================
"use client";

import { useTasksStore } from "@/modules/tasks/store";
import { cn } from "@/shared/utils/utils";

// ── Centered spinner ────────────────────────────────────────────────────────
// Used for List / Calendar / Now, and while the persisted viewMode hydrates.
export function TasksLoader() {
  return (
    <div className="flex h-full min-h-[60vh] w-full items-center justify-center">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-border-subtle border-t-text-tertiary" />
    </div>
  );
}

// ── Kanban skeleton ─────────────────────────────────────────────────────────

function Bar({ className, tone = "2" }: { className?: string; tone?: "2" | "3" }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded",
        tone === "3" ? "bg-surface-3" : "bg-surface-2",
        className,
      )}
    />
  );
}

function KanbanCardSkeleton({ withDesc }: { withDesc?: boolean }) {
  return (
    <div className="rounded-lg border border-border-subtle bg-surface-2 p-3">
      <div className="flex items-start justify-between gap-2">
        <Bar tone="3" className="h-3.5 w-3/5" />
        <Bar tone="3" className="h-5 w-5 shrink-0 rounded-full" />
      </div>
      {withDesc && <Bar tone="3" className="mt-2 h-3 w-4/5" />}
      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Bar tone="3" className="h-3.5 w-3.5 rounded-sm" />
          <Bar tone="3" className="h-4 w-12 rounded" />
        </div>
        <Bar tone="3" className="h-3 w-10" />
      </div>
    </div>
  );
}

function KanbanColumnSkeleton({ cards }: { cards: number }) {
  return (
    <div className="flex w-80 flex-col">
      {/* Column header: status icon + name + count · add button */}
      <div className="mb-2 flex items-center justify-between px-1 py-1">
        <div className="flex items-center gap-2">
          <Bar className="h-3.5 w-3.5 rounded-sm" />
          <Bar className="h-4 w-24" />
          <Bar className="h-4 w-6 rounded" />
        </div>
        <Bar className="h-5 w-5 rounded-md" />
      </div>
      {/* Column body */}
      <div className="space-y-2 rounded-lg border border-border-subtle bg-surface-1 p-2">
        {Array.from({ length: cards }).map((_, i) => (
          <KanbanCardSkeleton key={i} withDesc={i % 2 === 0} />
        ))}
      </div>
    </div>
  );
}

function KanbanSkeleton() {
  const columns = [3, 2, 4, 2];
  return (
    <div className="px-4 py-6">
      <div className="flex min-w-max gap-4">
        {columns.map((cards, i) => (
          <KanbanColumnSkeleton key={i} cards={cards} />
        ))}
      </div>
    </div>
  );
}

// ── Entry ───────────────────────────────────────────────────────────────────

export function TasksSkeleton() {
  const viewMode = useTasksStore((s) => s.viewMode);
  return viewMode === "kanban" ? <KanbanSkeleton /> : <TasksLoader />;
}
