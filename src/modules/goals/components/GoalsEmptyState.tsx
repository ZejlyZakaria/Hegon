"use client";

import { Button } from "@/shared/components/ui/button";

interface Props {
  onCreateClick: () => void;
}

export function GoalsEmptyState({ onCreateClick }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-2xl bg-[#18ad9d]/10 border border-zinc-800/60 flex items-center justify-center mb-6">
        <svg
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#18ad9d"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="12" r="6" />
          <circle cx="12" cy="12" r="2" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">Set your first direction</h3>
      <p className="text-sm text-zinc-500 mb-6 max-w-sm">
        Goals give meaning to everything else you track in HEGON.
      </p>
      <Button
        type="button"
        onClick={onCreateClick}
        style={{ backgroundColor: "#18ad9d" }}
        className="text-white hover:opacity-90"
      >
        + New Goal
      </Button>
    </div>
  );
}
