"use client";

import { Button } from "@/shared/components/ui/button";
import { FadeIn } from "@/shared/components/ui/motion";

const ACCENT_HEX = "#0ea5e9";

interface Props {
  onAddClick: () => void;
}

export function BooksEmptyState({ onAddClick }: Props) {
  return (
    <FadeIn y={12} className="flex flex-col items-center text-center max-w-xs mx-auto py-16">
      <svg width="80" height="72" viewBox="0 0 80 72" fill="none" className="mb-7">
        {/* Shelf base */}
        <line x1="4" y1="68" x2="76" y2="68" stroke={ACCENT_HEX} strokeWidth="1.5" strokeOpacity="0.2" strokeLinecap="round" />
        {/* Book 1 — left, shorter */}
        <rect x="8" y="34" width="14" height="34" rx="2" fill={ACCENT_HEX} fillOpacity="0.12" stroke={ACCENT_HEX} strokeWidth="1" strokeOpacity="0.2" />
        <line x1="13" y1="34" x2="13" y2="68" stroke={ACCENT_HEX} strokeWidth="1" strokeOpacity="0.1" />
        {/* Book 2 — center, tallest, highlighted */}
        <rect x="27" y="12" width="18" height="56" rx="2" fill={ACCENT_HEX} fillOpacity="0.22" stroke={ACCENT_HEX} strokeWidth="1.5" strokeOpacity="0.5" />
        <line x1="33" y1="12" x2="33" y2="68" stroke={ACCENT_HEX} strokeWidth="1" strokeOpacity="0.18" />
        {/* Book 3 — right, medium */}
        <rect x="51" y="22" width="16" height="46" rx="2" fill={ACCENT_HEX} fillOpacity="0.15" stroke={ACCENT_HEX} strokeWidth="1" strokeOpacity="0.28" />
        <line x1="56" y1="22" x2="56" y2="68" stroke={ACCENT_HEX} strokeWidth="1" strokeOpacity="0.12" />
      </svg>

      <h3 className="text-base font-semibold text-text-primary mb-2">
        Start your library
      </h3>
      <p className="text-sm text-text-tertiary leading-relaxed mb-7 px-2">
        Track what you read, what you want to read,
        and how far you&apos;ve come.
      </p>
      <Button variant="legacy"
        type="button"
        onClick={onAddClick}
        className="h-9 rounded-control px-4 text-sm font-medium text-white hover:opacity-90"
        style={{ backgroundColor: "var(--color-accent-books)" }}
      >
        + Add First Book
      </Button>
    </FadeIn>
  );
}
