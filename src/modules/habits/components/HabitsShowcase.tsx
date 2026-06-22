"use client";

import { useMemo } from "react";
import { Lock } from "lucide-react";
import { cn } from "@/shared/utils/utils";
import { useHabitsUIStore } from "../store";
import { HabitWatch, FACES, FACE_ORDER, type WatchFace } from "./HabitWatch";
import type { HabitWithStatus } from "../types";

const ACCENT = "var(--color-accent-habits-vivid)";

// Faces unlock by best streak (Onyx 0 · Sapphire 7 · Champagne 30 · Aventurine 100).
const PREVIEW_ALL_FACES = false;

interface Props {
  habits: HabitWithStatus[];
  className?: string;
}

export function HabitsShowcase({ habits, className }: Props) {
  const { watchFace, setWatchFace } = useHabitsUIStore();

  const maxBest = useMemo(
    () => (habits.length === 0 ? 0 : Math.max(...habits.map((h) => h.best_streak))),
    [habits],
  );

  const isUnlocked = (f: WatchFace) =>
    PREVIEW_ALL_FACES || FACES[f].unlockStreak <= maxBest;
  // Wear the selected face only if it's actually unlocked; otherwise fall back.
  const activeFace: WatchFace = isUnlocked(watchFace) ? watchFace : "onyx";

  const nextFace = FACE_ORDER.find((f) => FACES[f].unlockStreak > maxBest);
  const unlockProgress = nextFace
    ? Math.min(maxBest / FACES[nextFace].unlockStreak, 1)
    : 1;

  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-card surface-card p-4",
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
    </div>
  );
}
