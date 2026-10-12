import { viewingDate } from "./viewing-history";

export interface WatchDateParts {
  year: number;
  month: number | null;
  day: number | null;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** Legacy sorting projection ONLY. The original parts are canonical viewing history.
 * Past YEAR sorts at Dec 31; current YEAR sorts at now; MONTH uses its first day.
 * Existing Stats/rails retain this temporary convention. Never decode it into date precision.
 */
export function buildWatchedAtProjection(p: WatchDateParts, now: Date = new Date()): string {
  viewingDate(p);
  if (p.month === null) {
    return p.year >= now.getFullYear() ? now.toISOString() : new Date(Date.UTC(p.year, 11, 31, 12)).toISOString();
  }
  const iso = new Date(Date.UTC(p.year, p.month - 1, p.day ?? 1, 12));
  return iso.getTime() > now.getTime() ? now.toISOString() : iso.toISOString();
}
