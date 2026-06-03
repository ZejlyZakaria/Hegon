"use client";

import { useEffect } from "react";
import {
  Flame,
  Medal,
  Trophy,
  Gem,
  CalendarCheck,
  CalendarRange,
  Layers,
  RotateCcw,
  Lock,
  Check,
  type LucideIcon,
} from "lucide-react";
import { useHabits } from "../hooks/useHabits";
import { useHabitsToday } from "../hooks/useHabitsToday";
import { useHabitsUIStore } from "../store";
import { computeAchievements, type AchievementIcon } from "../achievements";
import { getTodayStr } from "../utils";
import { toast } from "@/shared/utils/toast";
import { cn } from "@/shared/utils/utils";

const ACCENT = "var(--color-accent-habits-vivid)";

const ICONS: Record<AchievementIcon, LucideIcon> = {
  flame: Flame,
  medal: Medal,
  trophy: Trophy,
  gem: Gem,
  calendarCheck: CalendarCheck,
  calendarRange: CalendarRange,
  layers: Layers,
  rotateCcw: RotateCcw,
};

// Each badge wears its own elemental color so the wall feels alive.
const ICON_COLOR: Record<AchievementIcon, string> = {
  flame: "var(--color-fire)",
  medal: "#cbd5e1", // silver
  trophy: "var(--color-gold)",
  gem: "var(--color-ice)",
  calendarCheck: ACCENT,
  calendarRange: ACCENT,
  layers: ACCENT,
  rotateCcw: ACCENT,
};

export function HabitsAchievements() {
  const { data: allHabits = [] } = useHabits();
  const { recentCompletions } = useHabitsToday();
  const today = getTodayStr();

  const achievements = computeAchievements({ habits: allHabits, recentCompletions, today });
  const unlockedKeys = achievements.filter((a) => a.unlocked).map((a) => a.key);
  const unlockedKey = unlockedKeys.join(",");

  const seen = useHabitsUIStore((s) => s.seenAchievements);
  const markSeen = useHabitsUIStore((s) => s.markAchievementsSeen);

  useEffect(() => {
    if (allHabits.length === 0) return;
    // First visit: silently baseline pre-existing achievements (no toast storm).
    if (seen.length === 0) {
      if (unlockedKeys.length) markSeen(unlockedKeys);
      return;
    }
    const fresh = unlockedKeys.filter((k) => !seen.includes(k));
    if (fresh.length > 0) {
      fresh.forEach((k) => {
        const a = achievements.find((x) => x.key === k);
        if (a) toast.success(`Achievement unlocked — ${a.name}`);
      });
      markSeen(Array.from(new Set([...seen, ...unlockedKeys])));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlockedKey, allHabits.length]);

  return (
    <div>
      <div className="mb-4 flex items-baseline gap-3">
        <h3 className="text-sm font-semibold text-text-primary">Achievements</h3>
        <span className="text-xs text-text-tertiary">
          <span className="font-semibold text-text-secondary">{unlockedKeys.length}</span> /{" "}
          {achievements.length} unlocked
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {achievements.map((a) => {
          const Icon = ICONS[a.icon];
          const c = ICON_COLOR[a.icon];
          return (
            <div
              key={a.key}
              className={cn(
                "rounded-xl border bg-surface-1 p-4",
                a.unlocked ? "border-transparent" : "border-border-subtle",
              )}
              style={a.unlocked ? { boxShadow: `inset 0 0 0 1px ${c}` } : undefined}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-lg",
                    !a.unlocked && "bg-surface-2",
                  )}
                  style={
                    a.unlocked
                      ? {
                          backgroundColor: `color-mix(in srgb, ${c} 18%, transparent)`,
                          color: c,
                        }
                      : { color: "var(--color-text-tertiary)" }
                  }
                >
                  <Icon size={18} />
                </div>
                {a.unlocked ? (
                  <Check size={14} style={{ color: c }} className="ml-auto" />
                ) : (
                  <Lock size={12} className="ml-auto text-text-tertiary" />
                )}
              </div>

              <p
                className={cn(
                  "mt-2.5 text-sm font-semibold",
                  a.unlocked ? "text-text-primary" : "text-text-secondary",
                )}
              >
                {a.name}
              </p>
              <p className="mt-0.5 text-[11px] leading-snug text-text-tertiary">
                {a.description}
              </p>

              {!a.unlocked && (
                <div className="mt-2.5">
                  <div className="h-1 w-full overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full rounded-full transition-[width] duration-500"
                      style={{ width: `${a.progress * 100}%`, backgroundColor: c }}
                    />
                  </div>
                  <p className="mt-1 text-[10px] text-text-tertiary">{a.progressLabel}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
