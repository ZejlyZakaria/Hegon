"use client";

import { Minus, Plus } from "lucide-react";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 text-sm font-semibold text-text-primary">{children}</h2>
  );
}

function StepControl({ label, value, onDecrement, onIncrement, min = 0 }: {
  label: string;
  value: number;
  onDecrement: () => void;
  onIncrement: () => void;
  min?: number;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-text-tertiary">{label}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onDecrement}
          disabled={value <= min}
          className="flex h-6 w-6 items-center justify-center rounded-md border border-border-subtle bg-surface-1 text-text-tertiary transition-colors hover:text-text-primary disabled:opacity-30"
        >
          <Minus size={11} />
        </button>
        <span className="w-6 text-center text-sm font-semibold tabular-nums text-text-primary">{value}</span>
        <button
          type="button"
          onClick={onIncrement}
          className="flex h-6 w-6 items-center justify-center rounded-md border border-border-subtle bg-surface-1 text-text-tertiary transition-colors hover:text-text-primary"
        >
          <Plus size={11} />
        </button>
      </div>
    </div>
  );
}

interface Props {
  currentSeason: number;
  currentEpisode: number;
  onUpdate: (season: number, episode: number) => void;
}

export function CurrentlyWatching({ currentSeason, currentEpisode, onUpdate }: Props) {
  return (
    <section>
      <SectionLabel>Currently Watching</SectionLabel>
      <div className="space-y-3 rounded-xl border border-border-subtle bg-surface-1/50 p-4">
        <StepControl
          label="Season"
          value={currentSeason}
          min={1}
          onDecrement={() => onUpdate(Math.max(1, currentSeason - 1), currentEpisode)}
          onIncrement={() => onUpdate(currentSeason + 1, currentEpisode)}
        />
        <StepControl
          label="Episode"
          value={currentEpisode}
          min={0}
          onDecrement={() => onUpdate(currentSeason, Math.max(0, currentEpisode - 1))}
          onIncrement={() => onUpdate(currentSeason, currentEpisode + 1)}
        />
      </div>
    </section>
  );
}
