"use client";

import { useId, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/shared/utils/utils";

export interface SegmentItem<T extends string> {
  value: T;
  label: ReactNode;
  icon?: ReactNode;
}

interface SegmentedControlProps<T extends string> {
  items: SegmentItem<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Hide the text label below `sm` (icon-only on mobile). */
  responsiveLabels?: boolean;
  size?: "sm" | "md";
  className?: string;
}

// HEGON secondary view-switcher — ONE canonical segmented pill.
// The active segment's filled background SLIDES between options (Framer layoutId),
// the exact motion sibling of TabNav's sliding underline, so primary + secondary
// navigation share one motion language. Grammar: underline tabs = "where am I /
// which page", this pill = "how I look at the same data".
export function SegmentedControl<T extends string>({
  items,
  value,
  onChange,
  responsiveLabels,
  size = "md",
  className,
}: SegmentedControlProps<T>) {
  const groupId = useId();
  const reduce = useReducedMotion();
  // The OUTER height is what matters: it's what a Button or a CarouselNav standing next to
  // it has to match. Sizing only the inner segments (as before) let the padding + border
  // decide the real height, so nothing could ever line up beside it.
  //   sm → 32px (Button size="sm" / icon-sm)   md → 36px (Button size="default")
  const box = size === "sm" ? "h-8 p-0.5" : "h-9 p-1";

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-control border border-border-subtle bg-surface-2",
        box,
        className,
      )}
    >
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            onClick={() => onChange(item.value)}
            className={cn(
              "relative flex h-full shrink-0 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium outline-none transition-colors",
              active ? "text-text-primary" : "text-text-tertiary hover:text-text-primary",
            )}
          >
            {active && (
              <motion.span
                layoutId={`segmented-${groupId}`}
                className="absolute inset-0 rounded-md bg-surface-3"
                transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 480, damping: 38 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5">
              {item.icon}
              {item.label != null && item.label !== "" && (
                <span className={responsiveLabels ? "hidden sm:inline" : undefined}>{item.label}</span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
