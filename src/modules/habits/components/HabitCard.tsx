"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Check, Flame, Link2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/utils/utils";
import { resolveIcon } from "@/shared/constants/icons";
import type { HabitWithStatus } from "../types";

const HABITS_ACCENT = "var(--color-accent-habits)";
const AMBER = "#f59e0b";

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
      onClick={handleToggle}
      className="group flex cursor-pointer items-center gap-3 rounded-lg border border-border-subtle bg-surface-1 p-3 transition-colors duration-100 hover:bg-surface-2"
    >
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border-subtle bg-surface-2"
        style={{ color: iconColor }}
      >
        <IconComponent size={18} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p
            className={cn(
              "truncate text-sm font-semibold leading-tight",
              completed_today ? "line-through text-text-tertiary" : "text-text-primary",
            )}
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
              <span className="text-[10px] font-medium" style={{ color: AMBER }}>
                Missed yesterday
              </span>
            </span>
          )}
        </div>

        {habit.description && (
          <p className="mt-0.5 truncate text-xs leading-snug text-text-secondary">
            {habit.description}
          </p>
        )}

        <div className="mt-1 flex items-center gap-2 flex-wrap">
          {habit.goal && (
            <span className="inline-flex items-center gap-1 text-[10px] leading-none text-text-tertiary transition-colors duration-100">
              <Link2 size={10} />
              <span className="truncate max-w-35">{habit.goal.title}</span>
            </span>
          )}

          {habit.frequency && (
            <span className="text-[10px] leading-none text-text-tertiary">
              {habit.frequency}
            </span>
          )}
        </div>
      </div>

      <div className="flex w-20 shrink-0 flex-col items-center gap-0.5 border-l border-border-default pl-3">
        <div className="flex items-center gap-1">
          <Flame
            size={12}
            style={{ color: current_streak > 0 ? HABITS_ACCENT : "var(--color-text-tertiary)" }}
          />
          <span className="text-[10px] leading-none text-text-tertiary">Streak</span>
        </div>

        <span
          className="text-sm font-bold leading-tight"
          style={{ color: current_streak > 0 ? HABITS_ACCENT : "var(--color-text-secondary)" }}
        >
          {current_streak}
        </span>

        <span className="text-[10px] leading-none text-text-tertiary">
          Best {best_streak}
        </span>
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
              onClick={(e) => { e.stopPropagation(); handleToggle(); }}
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
