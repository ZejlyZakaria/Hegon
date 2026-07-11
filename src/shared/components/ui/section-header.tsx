import type { ReactNode } from "react";
import { cn } from "@/shared/utils/utils";

interface SectionHeaderProps {
  title: ReactNode;
  /** One quiet line under the title. */
  subtitle?: ReactNode;
  /** Toolbar on the right — buttons, selects, carousel arrows. */
  actions?: ReactNode;
  className?: string;
}

/**
 * The one section header. Sections used to declare their own `<h2>`/`<h3>` with their own
 * weight and their own bottom margin — so titles of the same rank didn't share a size, and
 * the gap to their content varied per screen. Here the rank, the size and the spacing are
 * fixed; the section only supplies words and (optionally) a toolbar.
 *
 * No icon slot, on purpose: a section title is text. An icon on one heading and not on its
 * neighbour is exactly the incoherence this exists to kill.
 */
export function SectionHeader({ title, subtitle, actions, className }: SectionHeaderProps) {
  return (
    <div className={cn("mb-3 flex flex-wrap items-center justify-between gap-3", className)}>
      <div className="min-w-0">
        <h2 className="text-title text-text-primary">{title}</h2>
        {subtitle && <p className="mt-1 text-xs text-text-tertiary">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
