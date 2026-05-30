"use client";

import { useState } from "react";
import { Check, Minus, Plus, X } from "lucide-react";
import { cn } from "@/shared/utils/utils";

function StepControl({
  label,
  value,
  onDecrement,
  onIncrement,
  min = 0,
  max,
  total,
}: {
  label: string;
  value: number;
  onDecrement: () => void;
  onIncrement: () => void;
  min?: number;
  max?: number | null;
  total?: number | null;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-text-tertiary">{label}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onDecrement}
          disabled={value <= min}
          className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md border border-border-subtle bg-surface-1 text-text-tertiary transition-colors hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-30"
        >
          <Minus size={11} />
        </button>
        <span className={cn(
          "text-center text-sm font-semibold tabular-nums text-text-primary",
          total != null ? "min-w-14" : "w-6",
        )}>
          {total != null ? `${value} / ${total}` : value}
        </span>
        <button
          type="button"
          onClick={onIncrement}
          disabled={max != null && value >= max}
          className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md border border-border-subtle bg-surface-1 text-text-tertiary transition-colors hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-30"
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
  media: {
    seasons?: number;
    season_episodes?: number[] | null;
  };
  onMarkCompleted: () => void;
}

export function CurrentlyWatching({
  currentSeason,
  currentEpisode,
  onUpdate,
  media,
  onMarkCompleted,
}: Props) {
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const maxSeason = media.seasons ?? null;
  const episodesInCurrentSeason = media.season_episodes?.[currentSeason - 1] ?? null;
  const episodesInLastSeason = maxSeason != null ? (media.season_episodes?.[maxSeason - 1] ?? null) : null;

  const isAtLastEpisode =
    maxSeason != null &&
    episodesInLastSeason != null &&
    currentSeason === maxSeason &&
    currentEpisode === episodesInLastSeason;

  const showBanner = isAtLastEpisode && !bannerDismissed;

  const handleSeasonChange = (delta: number) => {
    const next = Math.max(1, Math.min(currentSeason + delta, maxSeason ?? Infinity));
    if (next === currentSeason) return;
    onUpdate(next, 0);
    setBannerDismissed(false);
  };

  const handleEpisodeChange = (delta: number) => {
    const max = episodesInCurrentSeason ?? Infinity;
    const next = Math.max(0, Math.min(currentEpisode + delta, max));
    if (next === currentEpisode) return;
    onUpdate(currentSeason, next);
    setBannerDismissed(false);
  };

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-text-primary">Currently Watching</h2>
      <div className="space-y-3 rounded-xl border border-border-subtle bg-surface-1/50 p-4">

        <StepControl
          label="Season"
          value={currentSeason}
          min={1}
          max={maxSeason}
          total={maxSeason}
          onDecrement={() => handleSeasonChange(-1)}
          onIncrement={() => handleSeasonChange(1)}
        />

        <StepControl
          label="Episode"
          value={currentEpisode}
          min={0}
          max={episodesInCurrentSeason}
          total={episodesInCurrentSeason}
          onDecrement={() => handleEpisodeChange(-1)}
          onIncrement={() => handleEpisodeChange(1)}
        />

        {showBanner && (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-accent-watching/20 bg-accent-watching/15 px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-white/80">Last episode reached</p>
              <p className="text-[10px] text-white/50">Ready to mark as completed?</p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={onMarkCompleted}
                className="flex items-center gap-1.5 rounded-md bg-accent-watching px-2.5 py-1.5 text-[11px] font-semibold text-white transition-opacity hover:opacity-90"
              >
                <Check size={10} />
                Mark as completed
              </button>
              <button
                type="button"
                onClick={() => setBannerDismissed(true)}
                className="flex h-7 w-7 items-center justify-center rounded-md text-white/40 transition-colors hover:text-white/70"
              >
                <X size={11} />
              </button>
            </div>
          </div>
        )}

      </div>
    </section>
  );
}
