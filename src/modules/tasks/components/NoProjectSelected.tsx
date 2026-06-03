"use client";

import { FolderOpen } from "lucide-react";

export function NoProjectSelected() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="flex max-w-xs flex-col items-center gap-5 text-center select-none">

        <div className="relative">
          <div className="absolute inset-0 scale-150 rounded-full blur-2xl"
            style={{ backgroundColor: "var(--color-surface-3)" }} />
          <div
            className="relative flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{
              backgroundColor: "var(--color-surface-2)",
              border: "1px solid var(--color-border-subtle)",
            }}
          >
            <FolderOpen size={22} style={{ color: "var(--color-text-tertiary)" }} />
          </div>
        </div>

        <div className="space-y-1.5">
          <p className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>
            No project selected
          </p>
          <p className="text-xs leading-relaxed" style={{ color: "var(--color-text-tertiary)" }}>
            Pick a project from the sidebar<br />or create a new one to get started.
          </p>
        </div>

      </div>
    </div>
  );
}
