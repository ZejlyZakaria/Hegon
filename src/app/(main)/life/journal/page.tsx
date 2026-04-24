"use client";

import { ErrorBoundary } from "react-error-boundary";
import { JournalPage } from "@/modules/journal/components/JournalPage";

function JournalError() {
  return (
    <div className="flex items-center justify-center py-24 text-sm text-zinc-500">
      Something went wrong loading your journal.
    </div>
  );
}

export default function JournalRoute() {
  return (
    <ErrorBoundary FallbackComponent={JournalError} onReset={() => window.location.reload()}>
      <JournalPage />
    </ErrorBoundary>
  );
}
