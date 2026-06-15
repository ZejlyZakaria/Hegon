import type { GoalCategory } from "./types";

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
