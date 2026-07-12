"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Clapperboard, Trophy } from "lucide-react";

const TEAL = "var(--color-accent-watching-vivid)";
const GOLD = "var(--color-gold)";

// The "ripple" — the felt moment when watching a film moves a Goal. Shown as a
// custom toast: the count ticks up and the progress bar fills old → new.
export function GoalRippleToast({
  title,
  oldCount,
  newCount,
  target,
}: {
  title: string;
  oldCount: number;
  newCount: number;
  target: number;
}) {
  const reached = target > 0 && newCount >= target;
  const accent = reached ? GOLD : TEAL;
  const oldPct = target > 0 ? Math.min(100, (oldCount / target) * 100) : 0;
  const newPct = target > 0 ? Math.min(100, (newCount / target) * 100) : 0;

  const [display, setDisplay] = useState(oldCount);
  useEffect(() => {
    const t = setTimeout(() => setDisplay(newCount), 120);
    return () => clearTimeout(t);
  }, [newCount]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3, ease: [0, 0, 0.2, 1] }}
      className="flex w-[330px] items-center gap-3 rounded-card border p-3"
      style={{
        background: "#1a1a1d",
        borderColor: `color-mix(in srgb, ${accent} 35%, transparent)`,
        boxShadow: "0 12px 28px -6px rgba(0,0,0,0.6)",
      }}
    >
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control"
        style={{ backgroundColor: `color-mix(in srgb, ${accent} 16%, transparent)`, color: accent }}
      >
        {reached ? <Trophy size={17} /> : <Clapperboard size={17} />}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold text-white">
          {reached ? "Goal reached! 🎉" : title}
        </p>
        {!reached && <p className="truncate text-micro text-white/50">{title}</p>}
        <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-white/10">
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: accent }}
            initial={{ width: `${oldPct}%` }}
            animate={{ width: `${newPct}%` }}
            transition={{ duration: 0.6, ease: [0, 0, 0.2, 1], delay: 0.12 }}
          />
        </div>
      </div>

      <div className="shrink-0 text-right tabular-nums">
        <span className="text-sm font-bold" style={{ color: accent }}>{display}</span>
        <span className="text-micro text-white/40"> / {target}</span>
      </div>
    </motion.div>
  );
}
