"use client";

import { cn } from "@/shared/utils/utils";
import type { Achievement } from "./computeStats";

interface Props {
  achievements: Achievement[];
}

function AchievementBadge({ a }: { a: Achievement }) {
  return (
    <div
      className={cn(
        "relative flex flex-col gap-2 rounded-xl border p-3 transition-all duration-300",
        a.unlocked
          ? "border-white/10 bg-surface-1"
          : "border-border-subtle bg-surface-1/40 opacity-60",
      )}
    >
      {/* Icon + lock */}
      <div className="flex items-start justify-between">
        <span className="text-2xl leading-none" style={{ filter: a.unlocked ? "none" : "grayscale(1)" }}>
          {a.icon}
        </span>
        {a.unlocked && (
          <div
            className="flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold"
            style={{ background: a.color, color: "#000" }}
          >
            ✓
          </div>
        )}
      </div>

      {/* Label */}
      <div>
        <p className="text-xs font-semibold text-text-primary leading-tight">{a.label}</p>
        <p className="mt-0.5 text-[10px] text-text-tertiary leading-tight">{a.description}</p>
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <div className="h-1 w-full overflow-hidden rounded-full bg-black/25">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${a.progress}%`,
              background: a.unlocked ? a.color : "rgba(255,255,255,0.15)",
            }}
          />
        </div>
        <p className="text-[9px] tabular-nums text-text-tertiary/60">{a.progressLabel}</p>
      </div>
    </div>
  );
}

export function AchievementsCard({ achievements }: Props) {
  const unlocked = achievements.filter((a) => a.unlocked).length;

  return (
    <div className="rounded-xl border border-border-subtle bg-surface-1 p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm">🏅</span>
          <p className="text-sm font-semibold text-text-primary">Achievements</p>
        </div>
        <span className="text-xs tabular-nums text-text-tertiary">
          {unlocked}/{achievements.length}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {achievements.map((a) => (
          <AchievementBadge key={a.id} a={a} />
        ))}
      </div>
    </div>
  );
}
