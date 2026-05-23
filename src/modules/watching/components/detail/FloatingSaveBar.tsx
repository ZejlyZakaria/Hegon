"use client";

import { cn } from "@/shared/utils/utils";

interface Props {
  isDirty: boolean;
  isPending: boolean;
  onSave: () => void;
  onDiscard: () => void;
}

export function FloatingSaveBar({ isDirty, isPending, onSave, onDiscard }: Props) {
  return (
    <div
      className={cn(
        "fixed bottom-6 left-1/2 z-50 -translate-x-1/2 transition-all duration-300",
        isDirty
          ? "pointer-events-auto translate-y-0 opacity-100"
          : "pointer-events-none translate-y-4 opacity-0",
      )}
    >
      <div className="flex items-center gap-3 rounded-2xl border border-border-default bg-surface-2/95 py-2.5 pl-5 pr-2.5 shadow-2xl backdrop-blur-xl">
        <span className="flex items-center gap-2 text-[13px] text-text-secondary">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
          Unsaved changes
        </span>
        <button
          type="button"
          onClick={onDiscard}
          disabled={isPending}
          className="rounded-lg px-3 py-1.5 text-[13px] font-medium text-text-tertiary transition-colors hover:text-text-primary disabled:opacity-50"
        >
          Discard
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={isPending}
          className="rounded-lg bg-accent-watching px-4 py-1.5 text-[13px] font-semibold text-white transition-colors hover:opacity-90 disabled:opacity-50"
        >
          {isPending ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
