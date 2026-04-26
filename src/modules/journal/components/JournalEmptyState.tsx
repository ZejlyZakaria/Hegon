"use client";

import { PenLine } from "lucide-react";

const ACCENT = "#f97316";

export function JournalEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center"
        style={{ backgroundColor: "rgba(249, 115, 22, 0.1)" }}
      >
        <PenLine className="w-8 h-8" style={{ color: ACCENT }} />
      </div>

      <div className="flex flex-col items-center gap-2 text-center">
        <h3 className="text-lg font-semibold text-text-primary">
          No entries yet
        </h3>
        <p className="text-sm text-text-tertiary max-w-xs">
          Go to Today and start writing — your thoughts, reflections and daily experiences will appear here.
        </p>
      </div>
    </div>
  );
}
