"use client";

import { Button } from "@/shared/components/ui/button";

export function WatchingReadError({ resource, cached = false, onRetry }: { resource: string; cached?: boolean; onRetry: () => void }) {
  return <div role="alert" className="surface-quiet flex flex-wrap items-center justify-between gap-3 rounded-card p-4">
    <p className="text-sm text-text-secondary">{cached ? `We couldn't refresh ${resource}. Showing saved data.` : `We couldn't load ${resource}. Your data has not been changed.`}</p>
    <Button size="sm" variant="quiet" onClick={onRetry}>Try again</Button>
  </div>;
}
