"use client";

import { Check, Loader2 } from "lucide-react";

// The canonical small inline-form action pair (Cancel + Save) for compact add/edit
// forms — Books quotes, Watching episode highlights, etc. ONE look everywhere:
// rounded-control, px-2.5 py-1.5, text-xs; Save = module accent + Check (spinner
// while saving); Cancel = ghost.
export function InlineFormActions({
  onCancel,
  onSave,
  saving = false,
  disabled = false,
  accent = "var(--color-accent-goals)",
  saveLabel = "Save",
}: {
  onCancel:   () => void;
  onSave:     () => void;
  saving?:    boolean;
  disabled?:  boolean;
  accent?:    string;
  saveLabel?: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={onCancel}
        className="rounded-control px-2.5 py-1.5 text-xs text-text-tertiary transition-colors hover:text-text-primary"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={onSave}
        disabled={disabled || saving}
        className="flex items-center gap-1 rounded-control px-2.5 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
        style={{ backgroundColor: accent }}
      >
        {saving ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
        {saveLabel}
      </button>
    </div>
  );
}
