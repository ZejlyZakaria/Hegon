"use client";

import { Button } from "@/shared/components/ui/button";

interface Props {
  onCreateClick: () => void;
}

export function GoalsEmptyState({ onCreateClick }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <svg
        width="32"
        height="32"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#71717a"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="mb-6"
      >
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="6" />
        <circle cx="12" cy="12" r="2" />
      </svg>
      <h3 className="text-sm font-medium text-[#a0a0a8] mb-2">Set your first direction</h3>
      <p className="text-xs text-[#71717a] mb-6 max-w-xs">
        Goals give meaning to everything else you track in HEGON.
      </p>
      <Button
        type="button"
        onClick={onCreateClick}
        className="h-8 px-3 text-white hover:opacity-90"
        style={{ backgroundColor: "var(--color-accent-goals)" }}
      >
        + New Goal
      </Button>
    </div>
  );
}