"use client";

import { use } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { MonthReport } from "@/modules/habits/components/MonthReport";

function ReportError() {
  return (
    <div className="flex items-center justify-center py-24 text-sm text-zinc-500">
      Something went wrong loading this month.
    </div>
  );
}

export default function MonthReportRoute({
  params,
}: {
  params: Promise<{ month: string }>;
}) {
  const { month } = use(params);
  return (
    <ErrorBoundary FallbackComponent={ReportError} onReset={() => window.location.reload()}>
      <MonthReport month={month} />
    </ErrorBoundary>
  );
}
