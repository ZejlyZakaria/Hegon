"use client";

import { ErrorBoundary } from "react-error-boundary";
import { HabitsPage } from "@/modules/habits/components/HabitsPage";

function HabitsError() {
  return (
    <div className="flex items-center justify-center py-24 text-sm text-zinc-500">
      Something went wrong loading your habits.
    </div>
  );
}

export default function HabitsRoute() {
  return (
    <ErrorBoundary FallbackComponent={HabitsError} onReset={() => window.location.reload()}>
      <HabitsPage />
    </ErrorBoundary>
  );
}
