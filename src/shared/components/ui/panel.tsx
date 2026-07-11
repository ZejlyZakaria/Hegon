import type { ReactNode } from "react";
import { cn } from "@/shared/utils/utils";

interface PanelProps {
  /** Omit when the content already names itself (My Take's big score IS its title). */
  title?: ReactNode;
  subtitle?: ReactNode;
  /** Toolbar on the right of the header — buttons, selects, carousel arrows. */
  actions?: ReactNode;
  children: ReactNode;
  /**
   * Content runs to the panel's edges (scrolling media rows). The header keeps its padding;
   * the row supplies its own, so a poster can still bleed past the fold.
   */
  bleed?: boolean;
  className?: string;
  contentClassName?: string;
}

/**
 * The container every section lives in. It exists so that spacing, the title's rank and the
 * gap between a heading and its content are decided ONCE, not re-improvised per section —
 * which is what made sections of equal weight breathe differently.
 *
 * It carries no emphasis: emphasis is a MATERIAL decision (the teal StatusCard), not a
 * question of having a frame. So the frame can be the default without spending any signal.
 *
 * Deliberately NOT `overflow-hidden`: media tiles grow on hover (our depth cue on black),
 * and a clipping panel would shave them. Scrolling rows already clip themselves.
 */
export function Panel({
  title, subtitle, actions, children, bleed, className, contentClassName,
}: PanelProps) {
  return (
    <section className={cn("surface-quiet rounded-card", className)}>
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 pb-3 pt-4 sm:px-5">
          <div className="min-w-0">
            {title && <h2 className="text-title text-text-primary">{title}</h2>}
            {subtitle && <p className="mt-1 text-xs text-text-tertiary">{subtitle}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      )}
      <div
        className={cn(
          bleed ? "pb-4 sm:pb-5" : "px-4 pb-4 sm:px-5 sm:pb-5",
          !title && !actions && "pt-4 sm:pt-5",
          contentClassName,
        )}
      >
        {children}
      </div>
    </section>
  );
}
