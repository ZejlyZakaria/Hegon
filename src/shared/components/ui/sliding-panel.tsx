"use client";

import { useEffect, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/shared/utils/utils";

// The shared HEGON right-side sliding panel — extracted from the identical chrome
// used by TaskDetailPanel / HabitDetailPanel (overlay z-40 + spring slide from the
// right z-50 + ESC/overlay to close). Presentational shell: each feature owns its
// own open state and supplies the title, body and (optional) sticky footer.
const SPRING = { type: "spring", damping: 30, stiffness: 280 } as const;

interface SlidingPanelProps {
  open:      boolean;
  onClose:   () => void;
  title?:    ReactNode;
  icon?:     ReactNode;
  /** "default" = sm:w-108 (432px), "wide" = sm:w-120 (480px, for dense forms). */
  width?:    "default" | "wide";
  /** Optional action(s) rendered in the header, just before the close button. */
  headerAction?: ReactNode;
  footer?:   ReactNode;
  children:  ReactNode;
}

export function SlidingPanel({
  open, onClose, title, icon, width = "default", headerAction, footer, children,
}: SlidingPanelProps) {
  // Close on Escape — matches the existing panels.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-40 bg-black/50"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={SPRING}
            className={cn(
              "fixed right-0 top-0 z-50 flex h-full w-full flex-col border-l border-border-strong bg-surface-1",
              width === "wide" ? "sm:w-120" : "sm:w-108",
            )}
            role="dialog"
            aria-modal="true"
          >
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border-subtle px-4 py-3">
              <div className="flex min-w-0 items-center gap-2">
                {icon}
                {typeof title === "string" ? (
                  <h2 className="truncate text-sm font-semibold text-text-primary">{title}</h2>
                ) : (
                  title
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {headerAction}
                <button
                  type="button"
                  onClick={onClose}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-surface-3 hover:text-text-primary"
                  aria-label="Close panel"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Body — scrolls */}
            <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>

            {/* Footer — sticky, optional */}
            {footer && (
              <div className="shrink-0 border-t border-border-subtle px-4 py-3">{footer}</div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
