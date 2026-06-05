"use client";

import {
  Flame,
  Medal,
  Trophy,
  Gem,
  CalendarCheck,
  CalendarRange,
  Layers,
  RotateCcw,
  Clapperboard,
  Tv,
  Star,
  Drama,
  Globe,
  Sparkles,
  Lock,
  Check,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/shared/utils/utils";
import type { Achievement, AchievementIcon } from "./types";

const ICONS: Record<AchievementIcon, LucideIcon> = {
  flame: Flame,
  medal: Medal,
  trophy: Trophy,
  gem: Gem,
  calendarCheck: CalendarCheck,
  calendarRange: CalendarRange,
  layers: Layers,
  rotateCcw: RotateCcw,
  clapperboard: Clapperboard,
  tv: Tv,
  star: Star,
  drama: Drama,
  globe: Globe,
  sparkles: Sparkles,
};

interface Props {
  achievements: Achievement[];
  /** Module accent (CSS color) — used for any badge without an explicit color. */
  accent: string;
  title?: string;
  className?: string;
}

export function AchievementGrid({ achievements, accent, title = "Achievements", className }: Props) {
  const unlocked = achievements.filter((a) => a.unlocked).length;

  return (
    <div className={className}>
      <div className="mb-4 flex items-baseline gap-3">
        <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
        <span className="text-xs text-text-tertiary">
          <span className="font-semibold text-text-secondary">{unlocked}</span> /{" "}
          {achievements.length} unlocked
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {achievements.map((a) => (
          <AchievementBadge key={a.key} a={a} accent={accent} />
        ))}
      </div>
    </div>
  );
}

function AchievementBadge({ a, accent }: { a: Achievement; accent: string }) {
  const Icon = ICONS[a.icon];
  const c = a.color ?? accent;

  return (
    <div
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
      <p className="mt-0.5 text-[11px] leading-snug text-text-tertiary">{a.description}</p>

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
}
