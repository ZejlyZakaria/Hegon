import { cn } from "@/shared/utils/utils";

// Glass widget container — fills its grid footprint (the cell grid decides the
// size; the widget just fills it). `size` is kept for semantics/API.

export type WidgetSize = "s" | "m" | "l";

export function WidgetShell({
  title,
  accent,
  children,
  className,
}: {
  size?: WidgetSize;
  title?: string;
  accent?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("glass-panel relative h-full w-full overflow-hidden rounded-[22px] p-4", className)}>
      {title && (
        <div className="mb-2 flex items-center gap-1.5">
          {accent && <span className="h-1.5 w-1.5 rounded-full" style={{ background: accent }} />}
          <span className="text-[11px] font-semibold text-white/70">{title}</span>
        </div>
      )}
      {children}
    </div>
  );
}
