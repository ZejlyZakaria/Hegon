import type { Goal, GoalCategory } from "./types";

// Single source of truth for the per-category identity colour — used by the card,
// the detail badge/progress, the Life Compass and the Focus hero. One hex per
// category so the whole module reads as one colour-coded system. The module's own
// accent (green) stays in globals.css as --color-accent-goals.
export const CATEGORY_COLOR: Record<GoalCategory, string> = {
  career:    "#3b82f6",
  health:    "#22c55e",
  finance:   "#06b6d4",
  growth:    "#eab308",
  lifestyle: "#ec4899",
  other:     "#71717a",
};

export const GOALS_ACCENT = "var(--color-accent-goals)";

// Resolve a goal's display colour: its category colour, or the module green if uncategorised.
export function categoryColor(category: GoalCategory | null): string {
  return category ? CATEGORY_COLOR[category] : "#22c55e";
}

// THE one definition of "overdue" — a goal is overdue only when it's still ACTIVE
// and its target date is strictly before today, both floored to local midnight so
// the deadline DAY itself is never overdue. Shared by the card, the detail page,
// the right-panel counter and the roadmap; they used to disagree on the due day
// (some fired at 00:00 UTC) and on paused goals (the card flagged them, nothing else did).
export function isGoalOverdue(goal: Pick<Goal, "target_date" | "status">): boolean {
  if (goal.status !== "active" || !goal.target_date) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(goal.target_date);
  due.setHours(0, 0, 0, 0);
  return due < today;
}
