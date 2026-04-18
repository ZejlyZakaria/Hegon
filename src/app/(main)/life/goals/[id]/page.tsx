"use client";

import { use } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { GoalDetailPage } from "@/modules/goals/components/GoalDetailPage";

function GoalDetailError() {
  return (
    <div className="flex items-center justify-center py-24 text-sm text-zinc-500">
      Something went wrong loading this goal.
    </div>
  );
}

interface Props {
  params: Promise<{ id: string }>;
}

export default function GoalDetailRoute({ params }: Props) {
  const { id } = use(params);
  return (
    <ErrorBoundary FallbackComponent={GoalDetailError} onReset={() => window.location.reload()}>
      <GoalDetailPage id={id} />
    </ErrorBoundary>
  );
}
