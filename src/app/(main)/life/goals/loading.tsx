import { GoalsLoadingSkeleton } from "@/modules/goals/components/GoalsSkeleton";

// Render the skeleton flush — it owns its full-width layout (flush toolbar +
// padded content), exactly like the real GoalsPage. No extra padding wrapper,
// or the toolbar stops being full-width.
export default function GoalsLoading() {
  return <GoalsLoadingSkeleton />;
}
