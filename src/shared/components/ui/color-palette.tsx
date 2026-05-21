"use client";

import { Check } from "lucide-react";

export const HEGON_COLORS = [
  "#6b7280", "#94a3b8", "#64748b",
  "#3b82f6", "#6366f1", "#8b5cf6", "#a855f7",
  "#ec4899", "#f43f5e",
  "#f97316", "#f59e0b", "#eab308",
  "#22c55e", "#10b981", "#14b8a6",
  "#06b6d4", "#0ea5e9",
];

interface ColorPaletteProps {
  selected: string;
  onChange: (color: string) => void;
}

export function ColorPalette({ selected, onChange }: ColorPaletteProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {HEGON_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className="relative h-5 w-5 rounded-full transition-transform hover:scale-110"
          style={{ backgroundColor: c }}
        >
          {selected === c && (
            <Check size={10} className="absolute inset-0 m-auto text-white" strokeWidth={3} />
          )}
        </button>
      ))}
    </div>
  );
}
