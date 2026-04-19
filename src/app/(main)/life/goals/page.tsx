"use client";

import { ErrorBoundary } from "react-error-boundary";
import { GoalsPage } from "@/modules/goals/components/GoalsPage";

function GoalsError() {
  return (
    <div className="flex items-center justify-center py-24 text-sm text-[#71717a]">
      Something went wrong loading your goals.
    </div>
  );
}

export default function GoalsRoute() {
  return (
    <ErrorBoundary FallbackComponent={GoalsError} onReset={() => window.location.reload()}>
      <GoalsPage />
    </ErrorBoundary>
  );
}
