"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Check, Flame } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/utils/utils";
import { resolveIcon } from "@/shared/constants/icons";
import type { HabitWithStatus } from "../types";

// ─── Progress ring ─────────────────────────────────────────────────────────────

function ProgressRing({ pct, color }: { pct: number; color: string }) {
  const size = 36;
  const r    = (size - 6) / 2; // 15
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct / 100);

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ display: "block", transform: "rotate(-90deg)" }}>
        {/* Track */}
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#27272a" strokeWidth={3} />
        {/* Fill */}
        {pct > 0 && (
          <circle
            cx={size / 2} cy={size / 2} r={r}
            fill="none"
            stroke={color}
            strokeWidth={3}
            strokeDasharray={`${circ} ${circ}`}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 0.5s ease" }}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[9px] font-bold" style={{ color: pct > 0 ? color : "#52525b" }}>
          {pct}%
        </span>
      </div>
    </div>
  );
}

const ACCENT = "#f43f5e";


interface Props {
  habit:        HabitWithStatus;
  onComplete:   (habitId: string) => void;
  onUncomplete: (habitId: string) => void;
  isPending?:   boolean;
}

export function HabitCard({ habit, onComplete, onUncomplete, isPending }: Props) {
  const { completed_today, completion_id, at_risk, current_streak, best_streak } = habit;
  const { icon: IconComponent, color } = resolveIcon(habit.icon);

  const handleToggle = () => {
    if (completed_today && completion_id) onUncomplete(habit.id);
    else onComplete(habit.id);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: completed_today ? 0.6 : 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="flex items-center gap-3 p-4 rounded-2xl border border-zinc-800/60 bg-zinc-900/80 backdrop-blur-sm"
    >
      {/* Icon */}
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{
          backgroundColor: `${color}18`,
          border: `1px solid ${color}30`,
          color,
        }}
      >
        <IconComponent size={18} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={cn(
          "text-sm font-semibold tracking-tight truncate",
          completed_today ? "text-zinc-500 line-through" : "text-zinc-200",
        )}>
          {habit.title}
        </p>

        {habit.description && (
          <p className="text-xs text-zinc-500 truncate mt-0.5">{habit.description}</p>
        )}

        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {habit.goal && (
            <span className="text-[10px] text-zinc-600">
              🔗 {habit.goal.title}
            </span>
          )}
          {at_risk && !completed_today && (
            <span className="text-[10px] font-medium text-amber-400/80">
              ⚠ Missed yesterday
            </span>
          )}
        </div>
      </div>

      {/* Streak section — w-20 matches ring width for consistent gap */}
      <div className="shrink-0 w-20 flex flex-col items-center gap-0.5 border-l border-zinc-800/60">
        <div className="flex items-center gap-1">
          <Flame
            size={11}
            className={current_streak > 0 ? "text-orange-400" : "text-zinc-700"}
          />
          <span className="text-[10px] text-zinc-500">Streak</span>
        </div>
        <span className={cn(
          "text-sm font-bold leading-tight",
          current_streak > 0 ? "text-zinc-200" : "text-zinc-600",
        )}>
          {current_streak} {current_streak === 1 ? "day" : "days"}
        </span>
        <span className="text-[10px] text-zinc-600">
          Best: {best_streak}
        </span>
      </div>

      {/* Progress ring — w-20 matches streak width for consistent gap */}
      <div className="shrink-0 w-20 flex items-center justify-center">
        <ProgressRing pct={completed_today ? 100 : 0} color={color} />
      </div>

      {/* Complete button — w-28 on the button itself keeps consistent width */}
      <div className="shrink-0">
        <AnimatePresence mode="wait">
          {completed_today ? (
            <motion.div
              key="done"
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1,    opacity: 1 }}
              exit={{    scale: 0.85, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <Button
                size="sm"
                onClick={handleToggle}
                disabled={isPending}
                className="w-28 bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/25 hover:text-emerald-300 gap-1.5"
              >
                <Check size={13} />
                Completed
              </Button>
            </motion.div>
          ) : (
            <motion.div
              key="todo"
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1,    opacity: 1 }}
              exit={{    scale: 0.85, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <Button
                size="sm"
                onClick={handleToggle}
                disabled={isPending}
                style={{ backgroundColor: ACCENT }}
                className="w-28 text-white hover:opacity-90"
              >
                Complete
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </motion.div>
  );
}
