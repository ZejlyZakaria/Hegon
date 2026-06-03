"use client";

import { useMemo } from "react";
import { Flame, Lock } from "lucide-react";
import { cn } from "@/shared/utils/utils";
import { useHabitsUIStore } from "../store";
import { HabitWatch, FACES, FACE_ORDER, type WatchFace } from "./HabitWatch";
import type { HabitWithStatus } from "../types";

const ACCENT = "var(--color-accent-habits-vivid)";
const FIRE = "var(--color-fire)";
const RING_R = 30;
const RING_C = 2 * Math.PI * RING_R;

// Faces unlock by best streak (Onyx 0 · Sapphire 7 · Champagne 30 · Aventurine 100).
const PREVIEW_ALL_FACES = false;

interface Props {
  habits: HabitWithStatus[];
  completed: number;
  total: number;
  className?: string;
}

export function HabitsShowcase({ habits, completed, total, className }: Props) {
  const { watchFace, setWatchFace } = useHabitsUIStore();

  const { maxCurrent, maxBest } = useMemo(() => {
    if (habits.length === 0) return { maxCurrent: 0, maxBest: 0 };
    return {
      maxCurrent: Math.max(...habits.map((h) => h.current_streak)),
      maxBest: Math.max(...habits.map((h) => h.best_streak)),
    };
  }, [habits]);

  const isUnlocked = (f: WatchFace) =>
    PREVIEW_ALL_FACES || FACES[f].unlockStreak <= maxBest;
  // Wear the selected face only if it's actually unlocked; otherwise fall back.
  const activeFace: WatchFace = isUnlocked(watchFace) ? watchFace : "onyx";

  const nextFace = FACE_ORDER.find((f) => FACES[f].unlockStreak > maxBest);
  const unlockProgress = nextFace
    ? Math.min(maxBest / FACES[nextFace].unlockStreak, 1)
    : 1;

  const ringPct = total > 0 ? completed / total : 0;
  const ringDash = ringPct * RING_C;

  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-lg border border-border-subtle bg-surface-1 p-4",
        className,
      )}
    >
      {/* Watch */}
      <HabitWatch face={activeFace} size={160} />

      {/* Face collection */}
      <div className="mt-5 flex items-center gap-2.5">
        {FACE_ORDER.map((f) => {
          const unlocked = isUnlocked(f);
          const active = f === activeFace;
          return (
            <button
              key={f}
              type="button"
              disabled={!unlocked}
              onClick={() => setWatchFace(f)}
              aria-label={
                unlocked
                  ? `Wear ${FACES[f].label} face`
                  : `${FACES[f].label} face — locked, ${FACES[f].unlockStreak} day streak`
              }
              title={
                unlocked
                  ? FACES[f].label
                  : `Locked · ${FACES[f].unlockStreak}-day streak`
              }
              className={cn(
                "relative h-6 w-6 rounded-full border border-white/15 transition-transform duration-150 ease-out",
                unlocked ? "cursor-pointer active:scale-90" : "cursor-not-allowed",
              )}
              style={{
                // show the dial (not the case) so each face's chip is distinct
                background: FACES[f].dialBase,
                // offset accent ring on the active face (gap via the surface-colored inner ring)
                ...(active
                  ? {
                      boxShadow: `0 0 0 2px var(--color-surface-1), 0 0 0 3.5px ${ACCENT}`,
                    }
                  : {}),
              }}
            >
              {!unlocked && (
                <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/55">
                  <Lock size={10} className="text-white/70" />
                </span>
              )}
            </button>
          );
        })}
      </div>

      <p className="mt-2 text-xs font-medium text-text-secondary">
        {FACES[activeFace].label}
      </p>

      {/* Next unlock */}
      {nextFace ? (
        <div className="mt-4 w-full">
          <div className="mb-1.5 flex items-center justify-between text-[11px]">
            <span className="text-text-tertiary">
              Next: {FACES[nextFace].label} face
            </span>
            <span className="font-medium text-text-secondary">
              {Math.max(FACES[nextFace].unlockStreak - maxBest, 0)}d left
            </span>
          </div>
          <div className="h-1 w-full overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full transition-[width] duration-500 ease-out"
              style={{ width: `${unlockProgress * 100}%`, backgroundColor: ACCENT }}
            />
          </div>
        </div>
      ) : (
        <p className="mt-4 text-[11px] text-text-tertiary">
          Every face unlocked. Legendary.
        </p>
      )}

      <div className="my-5 h-px w-full bg-border-subtle" />

      {/* Today ring + streak */}
      <div className="flex w-full items-center justify-between gap-4">
        <div className="relative h-19 w-19 shrink-0">
          <svg className="h-full w-full -rotate-90" viewBox="0 0 76 76">
            <circle
              cx="38"
              cy="38"
              r={RING_R}
              fill="none"
              stroke="var(--color-surface-2)"
              strokeWidth="6"
            />
            <circle
              cx="38"
              cy="38"
              r={RING_R}
              fill="none"
              stroke={ACCENT}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={`${ringDash} ${RING_C}`}
              className="transition-[stroke-dasharray] duration-500 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
            <span className="text-sm font-bold text-text-primary">
              {completed}/{total}
            </span>
            <span className="mt-0.5 text-[9px] text-text-tertiary">today</span>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <Flame
              size={16}
              style={{ color: maxCurrent > 0 ? FIRE : "var(--color-text-tertiary)" }}
            />
            <span
              className="text-2xl font-bold leading-none"
              style={{
                color: maxCurrent > 0 ? FIRE : "var(--color-text-secondary)",
              }}
            >
              {maxCurrent}
            </span>
            <span className="text-xs text-text-tertiary">day streak</span>
          </div>
          <p className="mt-1.5 text-[11px] text-text-tertiary">
            Best <span className="font-medium text-text-secondary">{maxBest}</span> days
          </p>
        </div>
      </div>
    </div>
  );
}
