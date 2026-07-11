import type { CSSProperties } from "react";

// The module's accent, fed to <Button variant="accent">. Declared once so no screen can
// drift onto a slightly different teal.
export const WATCHING_ACCENT = {
  "--btn-accent": "var(--color-accent-watching)",
} as CSSProperties;
