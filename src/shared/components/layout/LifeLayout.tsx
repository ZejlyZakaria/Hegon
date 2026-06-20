"use client";

import { motion } from "framer-motion";
import { type ReactNode } from "react";

// Shared 2-column shell for Life modules (Goals · Habits · Books). Locks the
// canonical rhythm — gap-6 left↔right, right rail w-72 — so it can't drift per
// module. The right panel is OPTIONAL: Books shows it only on the Reading tab.
//
// Removal is INSTANT (no exit animation): an exit would keep the panel in the DOM
// during its 0.22s fade-out, holding the left column narrow → the browse grid would
// flash constrained before snapping full-width. Instant removal = the grid is
// full-width immediately; it fades in via its own keyed FadeIn. Appearance still
// animates (fade + slide).
export function LifeLayout({
  children,
  right,
}: {
  children: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <div className="min-w-0 flex-1">{children}</div>
      {right && (
        <motion.aside
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="w-full lg:w-72 lg:shrink-0"
        >
          {right}
        </motion.aside>
      )}
    </div>
  );
}
