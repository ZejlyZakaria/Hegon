// Helpers for the per-season watch-year map ({ "<season>": <year> }).

// Merge years for the given seasons WITHOUT overwriting any already-set year
// (auto-capture must never clobber a manually-corrected season).
export function stampSeasons(
  existing: Record<string, number> | null | undefined,
  seasons: number[],
  year: number,
): Record<string, number> {
  const next = { ...(existing ?? {}) };
  for (const s of seasons) if (next[String(s)] == null) next[String(s)] = year;
  return next;
}

export function seasonRange(from: number, to: number): number[] {
  const out: number[] = [];
  for (let s = from; s <= to; s++) out.push(s);
  return out;
}
