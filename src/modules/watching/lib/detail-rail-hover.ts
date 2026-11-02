import type { PointerEvent } from "react";

/** Open only the edge touched by a zoomed card, including after horizontal navigation. */
export const detailRailHover = {
  onPointerOver(event: PointerEvent<HTMLElement>) {
    const rail = event.currentTarget;
    const card = Array.from(rail.children).find(child => child.contains(event.target as Node));
    if (!card) { delete rail.dataset.hoverEdge; delete rail.dataset.hoverClippedEnd; return; }
    const bounds = rail.getBoundingClientRect();
    const padding = parseFloat(getComputedStyle(rail).paddingLeft) || 0;
    const item = card.getBoundingClientRect();
    const start = item.left <= bounds.left + padding + padding;
    const end = item.right >= bounds.right - padding - padding;
    // A partly visible card must not reveal more of its image or caption on hover.
    // Allow subpixel scroll rounding at the true end of a rail.
    rail.toggleAttribute("data-hover-clipped-end", item.right > bounds.right - padding + 0.6);
    if (start || end) rail.dataset.hoverEdge = start && end ? "both" : start ? "start" : "end";
    else delete rail.dataset.hoverEdge;
  },
  onPointerLeave(event: PointerEvent<HTMLElement>) {
    delete event.currentTarget.dataset.hoverEdge;
    delete event.currentTarget.dataset.hoverClippedEnd;
  },
};
