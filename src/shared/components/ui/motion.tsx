"use client";

import { motion, AnimatePresence, useReducedMotion, type HTMLMotionProps } from "framer-motion";
import { type ReactNode } from "react";

// ── HEGON motion primitives — the single source of truth for entrance motion.
//
// Extracted from the Goals left-side card list (the validated reference feel):
// a soft fade + rise, staggered down a list, that re-animates on filter/reorder.
// Centralising it here keeps every module on the SAME timing the way the radius
// tokens keep every surface on the same corner — instead of ad-hoc motion.divs.
//
// Everything respects prefers-reduced-motion (instant, no transform).

const EASE = [0.22, 1, 0.36, 1] as const; // easeOut-ish, matches the list feel

// Per-item stagger step, capped: a 4-item list cascades nicely (~0.16s spread),
// but a 30-cover grid must NOT take 1.2s — cap the index so the tail stays snappy.
const STEP = 0.04;
const CAP = 8;

// ── StaggerList — wrap a mapped list/grid. Pair each child with <StaggerItem>.
// AnimatePresence + popLayout so removing/reordering animates (filters, sort).
export function StaggerList({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <AnimatePresence mode="popLayout" initial>
        {children}
      </AnimatePresence>
    </div>
  );
}

// ── StaggerItem — one row/card. Pass the map index for the cascade; pass a stable
// `key` (the consumer does, on this element).
export function StaggerItem({
  index = 0,
  children,
  className,
  ...rest
}: { index?: number; children: ReactNode } & HTMLMotionProps<"div">) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      layout
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4 }}
      transition={
        reduce
          ? { duration: 0.12 }
          : { duration: 0.18, delay: Math.min(index, CAP) * STEP, ease: EASE }
      }
      className={className}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

// ── FadeIn — a single element (panel, card, section) entering on mount. Optional
// `delay` to chain a few, `y` to tune the rise (use y={-6} for top bars/toolbars).
export function FadeIn({
  delay = 0,
  y = 8,
  children,
  className,
  ...rest
}: { delay?: number; y?: number; children: ReactNode } & HTMLMotionProps<"div">) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduce ? { duration: 0.12 } : { duration: 0.22, delay, ease: EASE }}
      className={className}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
