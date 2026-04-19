"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Check, Flame, Link2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/utils/utils";
import { resolveIcon } from "@/shared/constants/icons";
import type { HabitWithStatus } from "../types";

const HABITS_ACCENT = "var(--color-accent-habits)";
const SURFACE_1 = "var(--color-surface-1)";
const SURFACE_2 = "var(--color-surface-2)";
const TEXT_PRIMARY = "var(--color-text-primary)";
const TEXT_SECONDARY = "var(--color-text-secondary)";
const TEXT_TERTIARY = "var(--color-text-tertiary)";
const BORDER_SUBTLE = "var(--color-border-subtle)";
const BORDER_DEFAULT = "var(--color-border-default)";
const AMBER = "#f59e0b";

function ProgressRing({ pct }: { pct: number }) {
  const size = 36;
  const radius = (size - 6) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - pct / 100);

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        className="block -rotate-90"
        aria-hidden="true"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={SURFACE_2}
          strokeWidth={3}
        />
        {pct > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={HABITS_ACCENT}
            strokeWidth={3}
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset var(--motion-slow) ease" }}
          />
        )}
      </svg>

      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className="text-[10px] font-medium leading-none"
          style={{ color: pct > 0 ? HABITS_ACCENT : TEXT_TERTIARY }}
        >
          {pct}%
        </span>
      </div>
    </div>
  );
}

interface Props {
  habit: HabitWithStatus;
  onComplete: (habitId: string) => void;
  onUncomplete: (habitId: string) => void;
  isPending?: boolean;
}

export function HabitCard({
  habit,
  onComplete,
  onUncomplete,
  isPending = false,
}: Props) {
  const {
    completed_today,
    completion_id,
    at_risk,
    current_streak,
    best_streak,
  } = habit;
  const { icon: IconComponent, color: iconColor } = resolveIcon(habit.icon);

  const handleToggle = () => {
    if (completed_today && completion_id) {
      onUncomplete(habit.id);
      return;
    }

    onComplete(habit.id);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: completed_today ? 0.5 : 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 28 }}
      className="group flex items-center gap-3 rounded-lg border p-3"
      style={{
        backgroundColor: completed_today ? SURFACE_1 : SURFACE_1,
        borderColor: BORDER_SUBTLE,
      }}
    >
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border"
        style={{
          backgroundColor: SURFACE_2,
          borderColor: BORDER_SUBTLE,
          color: iconColor,
        }}
      >
        <IconComponent size={18} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p
            className={cn(
              "truncate text-sm font-semibold leading-tight",
              completed_today && "line-through",
            )}
            style={{ color: completed_today ? TEXT_TERTIARY : TEXT_PRIMARY }}
          >
            {habit.title}
          </p>

          {at_risk && !completed_today && (
            <span className="inline-flex items-center gap-1 leading-none">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: AMBER }}
                aria-hidden="true"
              />
              <span
                className="text-[10px] font-medium"
                style={{ color: AMBER }}
              >
                Missed yesterday
              </span>
            </span>
          )}
        </div>

        {habit.description && (
          <p
            className="mt-0.5 truncate text-xs leading-snug"
            style={{ color: TEXT_SECONDARY }}
          >
            {habit.description}
          </p>
        )}

        <div className="mt-1 flex items-center gap-2 flex-wrap">
          {habit.goal && (
            <span
              className="inline-flex items-center gap-1 text-[10px] leading-none transition-colors duration-100"
              style={{ color: TEXT_TERTIARY }}
            >
              <Link2 size={10} />
              <span className="truncate max-w-35">{habit.goal.title}</span>
            </span>
          )}

          {habit.frequency && (
            <span
              className="text-[10px] leading-none"
              style={{ color: TEXT_TERTIARY }}
            >
              {habit.frequency}
            </span>
          )}
        </div>
      </div>

      <div
        className="flex w-20 shrink-0 flex-col items-center gap-0.5 border-l pl-3"
        style={{ borderColor: BORDER_DEFAULT }}
      >
        <div className="flex items-center gap-1">
          <Flame
            size={12}
            style={{
              color: current_streak > 0 ? HABITS_ACCENT : TEXT_TERTIARY,
            }}
          />
          <span
            className="text-[10px] leading-none"
            style={{ color: TEXT_TERTIARY }}
          >
            Streak
          </span>
        </div>

        <span
          className="text-sm font-bold leading-tight"
          style={{ color: current_streak > 0 ? HABITS_ACCENT : TEXT_SECONDARY }}
        >
          {current_streak}
        </span>

        <span
          className="text-[10px] leading-none"
          style={{ color: TEXT_TERTIARY }}
        >
          Best {best_streak}
        </span>
      </div>

      <div className="flex w-16 shrink-0 items-center justify-center">
        <ProgressRing pct={completed_today ? 100 : 0} />
      </div>

      <div className="shrink-0">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={completed_today ? "completed" : "idle"}
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.85, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
          >
            <Button
              size="sm"
              variant="ghost"
              onClick={handleToggle}
              disabled={isPending}
              className={cn(
                "h-8 rounded-md px-3 text-sm font-medium shadow-none transition-colors duration-100",
                completed_today
                  ? "hover:bg-transparent"
                  : "text-text-secondary hover:bg-surface-2 hover:text-text-primary",
              )}
              style={
                completed_today
                  ? {
                      backgroundColor: "transparent",
                      color: HABITS_ACCENT,
                      border: "none",
                    }
                  : undefined
              }
            >
              <span className="inline-flex items-center gap-1.5">
                {completed_today && <Check size={14} />}
                {completed_today ? "Completed" : "Complete"}
              </span>
            </Button>
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
