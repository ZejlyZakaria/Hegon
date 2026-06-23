"use client";

import { cn } from "@/shared/utils/utils";
import { MOOD_CONFIG } from "../types";
import type { JournalMood } from "../types";

const MOODS: JournalMood[] = ["calm", "good", "neutral", "tired", "rough"];

interface Props {
  value: JournalMood | null;
  onChange: (mood: JournalMood) => void;
}

// Mood as expressive colour orbs — each in its own hue, faint at rest, the
// selected one fills solid + soft glow + grows. Warmer than plain text buttons.
export function MoodOrbs({ value, onChange }: Props) {
  return (
    <div className="flex items-center gap-4">
      {MOODS.map((mood) => {
        const cfg = MOOD_CONFIG[mood];
        const selected = value === mood;
        return (
          <button
            key={mood}
            type="button"
            onClick={() => onChange(mood)}
            aria-label={cfg.label}
            aria-pressed={selected}
            className="group flex flex-col items-center gap-1.5"
          >
            <span
              className={cn(
                "h-8 w-8 rounded-full transition-transform duration-200 ease-out",
                selected ? "scale-110" : "group-hover:scale-105",
              )}
              style={
                selected
                  ? {
                      backgroundColor: cfg.color,
                      boxShadow: `0 0 0 2px var(--color-surface-1), 0 0 14px ${cfg.color}`,
                    }
                  : {
                      backgroundColor: `color-mix(in srgb, ${cfg.color} 14%, transparent)`,
                      boxShadow: `inset 0 0 0 1.5px color-mix(in srgb, ${cfg.color} 45%, transparent)`,
                    }
              }
            />
            <span
              className="text-[10px] font-medium transition-colors"
              style={{ color: selected ? cfg.color : "var(--color-text-tertiary)" }}
            >
              {cfg.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
