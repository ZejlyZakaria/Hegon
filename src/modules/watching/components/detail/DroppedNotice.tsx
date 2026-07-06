"use client";

import { CircleSlash, RotateCcw } from "lucide-react";
import { dropReasonLabel } from "../../lib/drop-reasons";

// Shown on the detail page when a series is dropped (it has left In Progress but
// kept its position). Surfaces the captured reason and lets you resume.
export function DroppedNotice({
  reason, onResume,
}: {
  reason: string | null | undefined;
  onResume: () => void;
}) {
  const label = dropReasonLabel(reason);
  return (
    <section>
      <h2 className="mb-3 text-title text-text-primary">Dropped</h2>
      <div className="surface-quiet rounded-2xl p-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-text-tertiary">
            <CircleSlash size={15} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-text-primary">You dropped this series</p>
            {label && <p className="mt-0.5 text-xs text-text-tertiary">Reason: {label}</p>}
          </div>
        </div>
        <button
          type="button"
          onClick={onResume}
          className="mt-3 flex items-center gap-1.5 rounded-lg border border-border-subtle bg-surface-1 px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:text-text-primary"
        >
          <RotateCcw size={12} />
          Resume watching
        </button>
      </div>
    </section>
  );
}
