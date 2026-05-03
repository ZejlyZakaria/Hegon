import { GoalsLoadingSkeleton } from "@/modules/goals/components/GoalsSkeleton";

export default function GoalsLoading() {
  return (
    <div className="px-6 py-5">
      <GoalsLoadingSkeleton />
    </div>
  );
}
