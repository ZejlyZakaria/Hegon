"use client";

import type { JournalMood } from "../types";
import { MOOD_CONFIG } from "../types";

interface MoodPickerProps {
  value: JournalMood | null;
  onChange: (mood: JournalMood) => void;
}

const MOODS: JournalMood[] = ["calm", "good", "neutral", "tired", "rough"];

export function MoodPicker({ value, onChange }: MoodPickerProps) {
  return (
    <div className="flex items-center gap-1">
      {MOODS.map((mood) => {
        const isSelected = value === mood;
        const config = MOOD_CONFIG[mood];

        return (
          <button
            key={mood}
            type="button"
            onClick={() => onChange(mood)}
            className="relative px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
            style={
              isSelected
                ? { backgroundColor: "var(--color-surface-2)", color: config.color }
                : undefined
            }
            onMouseEnter={(e) => {
              if (!isSelected) {
                e.currentTarget.style.backgroundColor = "var(--color-surface-1)";
                e.currentTarget.style.color = "var(--color-text-secondary)";
              }
            }}
            onMouseLeave={(e) => {
              if (!isSelected) {
                e.currentTarget.style.backgroundColor = "";
                e.currentTarget.style.color = "";
              }
            }}
          >
            <span className={!isSelected ? "text-text-tertiary" : ""}>
              {config.label}
            </span>
            {isSelected && (
              <span
                className="absolute bottom-0 left-2 right-2 h-0.5 rounded-t-sm"
                style={{ backgroundColor: config.color }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
