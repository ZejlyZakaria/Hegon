import { GoalsLoadingSkeleton } from "@/modules/goals/components/GoalsSkeleton";

export default function GoalsLoading() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-5">
      <GoalsLoadingSkeleton />
    </div>
  );
}
