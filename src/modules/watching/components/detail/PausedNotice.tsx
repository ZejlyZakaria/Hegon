"use client";

import { PauseCircle, RotateCcw } from "lucide-react";

// Shown on the detail page when a series is paused (on hold). It has left In
// Progress but kept its position — resume whenever the time/mood is right.
export function PausedNotice({ onResume }: { onResume: () => void }) {
  return (
    <section>
      <h2 className="mb-3 text-title text-text-primary">Paused</h2>
      <div className="surface-quiet rounded-2xl p-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-sky-300">
            <PauseCircle size={15} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-text-primary">You paused this series</p>
            <p className="mt-0.5 text-xs text-text-tertiary">It kept its position — pick it back up any time.</p>
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
