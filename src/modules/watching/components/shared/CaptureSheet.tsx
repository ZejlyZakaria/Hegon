"use client";

import type { ReactNode } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/shared/components/ui/dialog";

export interface CaptureOption {
  value: string;
  label: string;
  icon?: ReactNode;
}

// The reusable "capture without friction" picker for Couche 2 — a small dialog of
// 1-tap chips (tap a chip = pick + close, no confirm step) plus an optional Skip.
// First used for the drop reason; mood / source / who-where will reuse it.
interface CaptureSheetProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  subtitle?: string;
  options: CaptureOption[];
  onPick: (value: string) => void;
  onSkip?: () => void;
  skipLabel?: string;
}

export function CaptureSheet({
  open, onOpenChange, title, subtitle, options, onPick, onSkip, skipLabel = "Skip",
}: CaptureSheetProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogTitle>{title}</DialogTitle>
        {subtitle
          ? <DialogDescription>{subtitle}</DialogDescription>
          : <DialogDescription className="sr-only">{title}</DialogDescription>}

        <div className="grid gap-2">
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => { onPick(o.value); onOpenChange(false); }}
              className="flex items-center gap-2.5 rounded-xl border border-border-subtle bg-surface-2 px-3.5 py-2.5 text-left text-sm text-text-secondary transition-colors hover:bg-surface-3 hover:text-text-primary"
            >
              {o.icon && <span className="shrink-0 text-text-tertiary">{o.icon}</span>}
              {o.label}
            </button>
          ))}
        </div>

        {onSkip && (
          <button
            type="button"
            onClick={() => { onSkip(); onOpenChange(false); }}
            className="-mt-1 w-full rounded-lg py-1.5 text-center text-xs font-medium text-text-tertiary transition-colors hover:text-text-primary"
          >
            {skipLabel}
          </button>
        )}
      </DialogContent>
    </Dialog>
  );
}
