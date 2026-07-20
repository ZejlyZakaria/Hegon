// Helpers for the per-season watch-year map ({ "<season>": <year> }).

/**
 * Merge years for the given seasons. An already-set year is KEPT — auto-capture must never clobber
 * a season you dated by hand: you watched Blue Lock season 2 in 2019, you said so, and finishing
 * season 5 today must not rewrite that to 2026.
 *
 * ── UNLESS THE STAMP IS STALE ────────────────────────────────────────────────────────────────
 * That protection had no notion of a stamp that no longer belongs to anything. Set season 2 to
 * 2025, then move your position back to "through season 1": season 2 is not watched any more, and
 * the app already STOPS READING its year (see `reachedEntries`). Claim it again and you got 2025
 * back — the poster remembering a viewing you had just retracted.
 *
 * The line is not "was it set by hand", it is: ARE YOU CURRENTLY CLAIMING THIS SEASON?
 *   · behind your position → you claim it → the year is yours, and it is protected.
 *   · ahead of your position → you claim nothing → its year is a leftover, and a NEW claim re-dates it.
 *
 * Nothing is ever deleted, so a position moved back by mistake and moved forward again by a
 * CORRECTION still finds its years intact (a correction stamps nothing at all).
 */
export function stampSeasons(
  existing: Record<string, number> | null | undefined,
  seasons: number[],
  year: number,
  /** True for a season whose existing stamp is no longer claimed — and may therefore be re-dated. */
  isStale?: (season: number) => boolean,
): Record<string, number> {
  const next = { ...(existing ?? {}) };
  for (const s of seasons) {
    if (next[String(s)] == null || isStale?.(s)) next[String(s)] = year;
  }
  return next;
}

export function seasonRange(from: number, to: number): number[] {
  const out: number[] = [];
  for (let s = from; s <= to; s++) out.push(s);
  return out;
}
