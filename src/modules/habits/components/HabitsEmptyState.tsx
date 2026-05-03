"use client";

import { motion } from "framer-motion";
import { Button } from "@/shared/components/ui/button";

const ACCENT_HEX = "#f43f5e";
const DAYS = ["M", "T", "W", "T", "F", "S", "S"];
const FILLS = [0.25, 0.55, 1, 0.8, 0.45, 0.1, 0];

function MiniRing({ pct }: { pct: number }) {
  const r = 13;
  const circumference = 2 * Math.PI * r;
  const dash = pct * circumference;

  return (
    <svg width="34" height="34" viewBox="0 0 34 34">
      <circle cx="17" cy="17" r={r} fill="none" stroke="#27272a" strokeWidth="3" />
      {pct > 0 && (
        <circle
          cx="17" cy="17" r={r}
          fill="none"
          stroke={ACCENT_HEX}
          strokeWidth="3"
          strokeDasharray={`${dash} ${circumference}`}
          strokeLinecap="round"
          strokeOpacity={0.25 + pct * 0.75}
          transform="rotate(-90 17 17)"
        />
      )}
    </svg>
  );
}

interface Props {
  onCreateClick: () => void;
}

export function HabitsEmptyState({ onCreateClick }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="flex flex-col items-center text-center max-w-xs mx-auto py-16"
    >
      <div className="flex items-center gap-2 mb-7">
        {FILLS.map((fill, i) => (
          <div key={i} className="flex flex-col items-center gap-1.5">
            <MiniRing pct={fill} />
            <span className="text-[9px] font-medium text-text-tertiary">{DAYS[i]}</span>
          </div>
        ))}
      </div>

      <h3 className="text-base font-semibold text-text-primary mb-2">
        Build your daily rhythm
      </h3>
      <p className="text-sm text-text-tertiary leading-relaxed mb-7 px-2">
        Small consistent actions compound into big results.
        Start tracking your first habit today.
      </p>
      <Button
        type="button"
        onClick={onCreateClick}
        className="h-8 px-4 text-sm font-medium text-white hover:opacity-90"
        style={{ backgroundColor: "var(--color-accent-habits)" }}
      >
        + Add New Habit
      </Button>
    </motion.div>
  );
}
