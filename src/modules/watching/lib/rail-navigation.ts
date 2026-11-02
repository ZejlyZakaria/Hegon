/** Align intermediate pages to cards, but finish exactly at the natural trailing edge. */
export function railGeometry(offsets: number[], cardWidth: number, viewport: number, startPadding: number) {
  const last = offsets.at(-1) ?? 0;
  const pitch = offsets.length > 1 ? offsets[1] - offsets[0] : cardWidth;
  const usable = Math.max(0, viewport - 2 * startPadding);
  const max = Math.max(0, last + cardWidth - usable);
  const targets = offsets.filter(n=>n<max-0.5);
  if (!targets.length || Math.abs(targets[targets.length-1]-max)>0.5) targets.push(max);
  return { targets, page: Math.max(1, Math.floor((usable + pitch - cardWidth) / Math.max(1, pitch))) };
}
