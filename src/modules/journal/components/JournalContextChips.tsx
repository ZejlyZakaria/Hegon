"use client";

import { CheckCircle2, Film, BookOpen, X, type LucideIcon } from "lucide-react";
import { CONTEXT_COLOR } from "../lib/context";
import type { JournalContextItem, JournalContextType } from "../types";

const ICON: Record<JournalContextType, LucideIcon> = {
  habits: CheckCircle2,
  watching: Film,
  books: BookOpen,
};

// Context as chips — semantic icon + module colour. Optional per-chip remove
// (hover-revealed X), used where the context is attached to an entry.
export function JournalContextChips({
  items,
  onRemove,
}: {
  items: JournalContextItem[];
  onRemove?: (index: number) => void;
}) {
  return (
    <>
      {items.map((it, i) => {
        const Icon = ICON[it.type];
        return (
          <span
            key={i}
            className="group/ctx inline-flex items-center gap-1.5 rounded-control bg-surface-2 px-2.5 py-1 text-xs text-text-secondary"
          >
            <Icon size={13} style={{ color: CONTEXT_COLOR[it.type] }} />
            <span className="max-w-44 truncate">{it.label}</span>
            {onRemove && (
              <button
                type="button"
                onClick={() => onRemove(i)}
                aria-label="Remove from entry"
                className="text-text-tertiary opacity-0 transition-opacity hover:text-text-primary group-hover/ctx:opacity-100"
              >
                <X size={11} />
              </button>
            )}
          </span>
        );
      })}
    </>
  );
}
