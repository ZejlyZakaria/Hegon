// Reasons you drop a series — the first capture vocabulary of Couche 2. Kept as a
// shared list so the picker (CaptureSheet) and the detail-page display stay in sync.
export interface DropReason {
  value: string;
  label: string;
}

export const DROP_REASONS: DropReason[] = [
  { value: "too_slow", label: "Too slow / boring" },
  { value: "lost_interest", label: "Lost interest" },
  { value: "went_downhill", label: "It went downhill" },
  { value: "no_time", label: "No time right now" },
  { value: "not_for_me", label: "Just not for me" },
];

export function dropReasonLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  return DROP_REASONS.find((r) => r.value === value)?.label ?? null;
}
