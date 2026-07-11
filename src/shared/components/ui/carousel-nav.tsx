"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./button";
import { cn } from "@/shared/utils/utils";

interface CarouselNavProps {
  onPrev: () => void;
  onNext: () => void;
  /** Omit to always allow scrolling (the container just clamps). */
  canPrev?: boolean;
  canNext?: boolean;
  /** "sm" = h-6 (inside a rail card), "md" = h-8 (page sections). */
  size?: "sm" | "md";
  className?: string;
}

// The one pair of scroll arrows in HEGON. Every carousel had reinvented it — h-6/rounded-md
// here, h-7/rounded-lg there, rounded-full elsewhere — which is exactly why two buttons
// sitting side by side never lined up. One size scale, one radius, one disabled state.
export function CarouselNav({
  onPrev, onNext, canPrev = true, canNext = true, size = "md", className,
}: CarouselNavProps) {
  const box = size === "sm" ? "size-6 [&_svg]:size-3.5" : "size-8";

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <Button
        variant="quiet"
        size="icon-sm"
        onClick={onPrev}
        disabled={!canPrev}
        aria-label="Previous"
        className={box}
      >
        <ChevronLeft />
      </Button>
      <Button
        variant="quiet"
        size="icon-sm"
        onClick={onNext}
        disabled={!canNext}
        aria-label="Next"
        className={box}
      >
        <ChevronRight />
      </Button>
    </div>
  );
}
