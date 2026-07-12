"use client";

import { motion } from "framer-motion";
import { Check, Flame } from "lucide-react";
import { toast } from "@/shared/utils/toast";

const ACCENT = "var(--color-accent-habits-vivid)";
const FIRE = "var(--color-fire)";

// Habit equivalent of GoalRippleToast — the felt moment when watching a film
// auto-completes a linked habit. Custom animated toast, consistent with Goals.
export function HabitRippleToast({
  title,
  streak,
  weekly,
}: {
  title: string;
  streak: number;
  weekly: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3, ease: [0, 0, 0.2, 1] }}
      className="flex w-[330px] items-center gap-3 rounded-card border p-3"
      style={{
        background: "#1a1a1d",
        borderColor: `color-mix(in srgb, ${ACCENT} 35%, transparent)`,
        boxShadow: "0 12px 28px -6px rgba(0,0,0,0.6)",
      }}
    >
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, type: "spring", stiffness: 400, damping: 18 }}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control"
        style={{ backgroundColor: `color-mix(in srgb, ${ACCENT} 16%, transparent)`, color: ACCENT }}
      >
        <Check size={18} strokeWidth={3} />
      </motion.div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold text-white">
          {weekly ? "Done this week ✓" : "Done today ✓"}
        </p>
        <p className="truncate text-micro text-white/50">{title}</p>
      </div>

      {streak > 0 && (
        <div className="flex shrink-0 items-center gap-1 tabular-nums">
          <Flame size={13} style={{ color: FIRE }} />
          <span className="text-sm font-bold" style={{ color: FIRE }}>
            {streak}
          </span>
          <span className="text-micro text-white/40">{weekly ? "wk" : "d"}</span>
        </div>
      )}
    </motion.div>
  );
}

export function showHabitRipple(
  ticks: { title: string; streak: number; weekly: boolean }[],
) {
  for (const t of ticks.slice(0, 2)) {
    toast.custom(() => (
      <HabitRippleToast title={t.title} streak={t.streak} weekly={t.weekly} />
    ));
  }
}
