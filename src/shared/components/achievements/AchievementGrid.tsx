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
  Clock,
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
  clock: Clock,
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
          <span className="font-semibold text-text-secondary">{unlocked}</span> / {achievements.length} unlocked
        </span>
      </div>

      {/* Six to a row on a real desktop — a compact wall you scan by colour and icon, not by
          reading. But six only from xl: at lg (an iPad landscape) six columns crushed each badge to
          ~175px, so the ladder stops at four there and the tiles keep room to breathe. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {achievements.map((a) => (
          <AchievementBadge key={a.key} a={a} accent={accent} />
        ))}
      </div>
    </div>
  );
}

// One badge — locked (muted, with a progress bar) or unlocked (its colour lit). Depth comes from the
// SURFACE and a whisper of corner tint, never a coloured glow (HEGON: emphasis is material, not light).
function AchievementBadge({ a, accent }: { a: Achievement; accent: string }) {
  const Icon = ICONS[a.icon];
  const c = a.color ?? accent;

  return (
    <div
      className={cn(
        "relative flex h-full flex-col overflow-hidden rounded-card border bg-surface-1 p-3.5",
        a.unlocked ? "border-transparent" : "border-border-subtle",
      )}
      style={a.unlocked ? { boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${c} 45%, transparent)` } : undefined}
    >
      {/* corner tint — a whisper, only once earned */}
      {a.unlocked && (
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.10]"
          style={{ background: `radial-gradient(90% 130% at 0% 0%, ${c}, transparent 55%)` }}
        />
      )}

      <div className="relative flex items-center justify-between">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-control"
          style={
            a.unlocked
              ? { backgroundColor: `color-mix(in srgb, ${c} 18%, transparent)`, color: c }
              : { backgroundColor: "var(--color-surface-2)", color: "var(--color-text-tertiary)" }
          }
        >
          <Icon size={19} strokeWidth={1.8} />
        </div>
        {a.unlocked ? (
          <Check size={15} style={{ color: c }} />
        ) : (
          <Lock size={13} className="text-text-tertiary" />
        )}
      </div>

      <p className={cn("relative mt-2.5 text-sm font-semibold", a.unlocked ? "text-text-primary" : "text-text-secondary")}>
        {a.name}
      </p>
      <p className="relative mt-0.5 text-[11px] leading-snug text-text-tertiary">{a.description}</p>

      {/* keeps every card the same height whether or not it carries a progress bar */}
      <div className="flex-1" />

      {a.unlocked ? (
        <p className="relative mt-2.5 text-[10.5px] font-medium uppercase tracking-wide" style={{ color: c }}>
          Unlocked
        </p>
      ) : (
        <div className="relative mt-2.5">
          <div className="h-1 w-full overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{ width: `${a.progress * 100}%`, backgroundColor: c }}
            />
          </div>
          <p className="mt-1 text-[10px] tabular-nums text-text-tertiary">{a.progressLabel}</p>
        </div>
      )}
    </div>
  );
}
