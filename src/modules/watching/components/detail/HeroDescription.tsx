"use client";

import { useState } from "react";

// JS truncation (not line-clamp): no color mask over the backdrop photo, so "More"
// reads inline as "…More" on any background. Shared by the media hero and the person
// hero so both behave identically. Clamped to ~3 lines, expands in place.
export function HeroDescription({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  // null = not yet measured (render full to measure) · -1 = fits, no toggle · n = collapse at n chars
  const [cut, setCut] = useState<number | null>(null);

  const measure = (el: HTMLParagraphElement | null) => {
    // Ref callback runs at commit (not render) → measuring is lint-safe.
    if (!el || expanded || cut !== null) return;
    const lh = parseFloat(getComputedStyle(el).lineHeight) || 22;
    const lines = Math.round(el.scrollHeight / lh);
    if (lines <= 3) { setCut(-1); return; }
    const approx = Math.floor(text.length * (3 / lines) * 0.92);
    const boundary = text.lastIndexOf(" ", approx);
    setCut(boundary > 40 ? boundary : approx);
  };

  const btn = "font-medium text-white/45 transition-colors hover:text-white/80";
  const collapsed = !expanded && cut !== null && cut !== -1;

  return (
    <div className="mt-3 max-w-4xl">
      <p ref={measure} className="text-sm leading-relaxed text-white/60">
        {collapsed ? (
          <>
            {text.slice(0, cut).trimEnd()}
            {"… "}
            <button type="button" onClick={() => setExpanded(true)} className={btn}>More</button>
          </>
        ) : expanded ? (
          <>
            {text}{" "}
            <button type="button" onClick={() => setExpanded(false)} className={btn}>Less</button>
          </>
        ) : (
          text
        )}
      </p>
    </div>
  );
}
