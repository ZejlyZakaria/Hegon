"use client";

import { Children, useRef, useState, type ReactNode } from "react";
import { cn } from "@/shared/utils/utils";

// iOS Smart Stack — a fixed widget slot holding N stacked cards. Native
// scroll-snap drives buttery paging; side dots show position. Each card fills
// the whole slot (no peek — the dots are the affordance). Generic: Sport is the
// first consumer, but any slot can be a stack.
export function WidgetStack({ children, className }: { children: ReactNode; className?: string }) {
  const items = Children.toArray(children);
  const n = items.length;
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const single = n <= 1;

  const onScroll = () => {
    const el = ref.current;
    if (!el) return;
    const i = Math.round(el.scrollTop / el.clientHeight);
    setActive(Math.max(0, Math.min(n - 1, i)));
  };

  return (
    <div className={cn("relative h-full w-full", className)}>
      <div
        ref={ref}
        onScroll={single ? undefined : onScroll}
        className={cn(
          "h-full w-full overscroll-contain custom-scrollbar-hide",
          single ? "overflow-hidden" : "snap-y snap-mandatory overflow-y-auto",
        )}
      >
        {items.map((child, k) => (
          <div key={k} className="h-full w-full snap-start">
            {child}
          </div>
        ))}
      </div>

      {/* stack indicator */}
      {!single && (
        <div className="pointer-events-none absolute right-2 top-1/2 flex -translate-y-1/2 flex-col gap-1.5">
          {items.map((_, k) => (
            <span
              key={k}
              className="h-1.5 w-1.5 rounded-full transition-all duration-200"
              style={{ background: active === k ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.3)" }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
