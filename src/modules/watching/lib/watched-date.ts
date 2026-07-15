/**
 * WHEN did you watch it — one construction rule, shared by the add flow and the detail-page edit.
 *
 * These two used to build `watched_at` differently: the add modal stamped the 1st of a chosen
 * month, the detail page stamped December 31st of a chosen year. So the same intent ("I watched
 * this in 2024") produced two different timestamps depending on which screen you used, and two
 * different positions in a Recently Watched rail that sorts by exactly this value. One rule now.
 *
 * Precision is optional and it degrades honestly: give a full date and it's kept to the day; give a
 * month and it's the 1st; give only a year and it's the end of that year — EXCEPT the current year,
 * where "December 31st" is still in the future and would both sort above things you watched last
 * week and claim a date you haven't reached. There, "now" is the only truthful default.
 */

export interface WatchDateParts {
  year: number;
  month: number | null;   // 1–12, or null (unknown)
  day: number | null;     // 1–31, or null (unknown)
}

/** Days in a given month, leap-year aware. `month` is 1-based. */
export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();   // day 0 of the next month = last day of this one
}

/** Build the stored `watched_at` (noon UTC, to sit clear of timezone edges) from loose parts. */
export function buildWatchedAt(p: WatchDateParts, now: Date = new Date()): string {
  if (p.month == null) {
    // Year only. A past year → its close (Dec 31), so it sorts at the end of that year. The current
    // (or a future) year → now: "Dec 31 this year" hasn't happened, and dating a viewing in the
    // future is the one thing this must never do.
    return p.year >= now.getFullYear()
      ? now.toISOString()
      : new Date(Date.UTC(p.year, 11, 31, 12)).toISOString();
  }
  const day = p.day ?? 1;   // a month with no day → the 1st
  const iso = new Date(Date.UTC(p.year, p.month - 1, day, 12));
  // A guard against a picker that let through a still-future day in the current month: never date
  // a viewing ahead of now.
  return iso.getTime() > now.getTime() ? now.toISOString() : iso.toISOString();
}

/** Read an ISO timestamp back into parts, to seed the picker from an existing `watched_at`.
 *  Reads in UTC to mirror buildWatchedAt's UTC construction — the round-trip is exact in any zone. */
export function partsFromISO(iso: string | null | undefined): WatchDateParts | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}
