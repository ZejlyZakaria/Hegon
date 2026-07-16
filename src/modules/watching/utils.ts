// Use original_title if Latin script (incl. French/Spanish accents up to U+024F).
// Fall back to title for CJK, Korean, Arabic, etc.
export function displayTitle(item: { title: string; original_title: string | null }): string {
  if (!item.original_title) return item.title;
  return /[ɐ-￿]/.test(item.original_title) ? item.title : item.original_title;
}

/**
 * "When did I watch this", said the way a person would — the quick cue on a Recently Watched card.
 *
 * It reads `watched_at`, which is the whole point now that the section is DERIVED from that date
 * rather than from a stale `recently_watched` flag: the ordering is the date, so surfacing it makes
 * the ordering legible. Relative on purpose — in this section everything is recent by construction,
 * so you see "Yesterday", "3 days ago", "Last week", never a vague far-off date.
 *
 * Returns null when there is nothing honest to say: no date, or a date in the FUTURE (a film dated
 * by year stamps `Dec 31` of that year, which is ahead of us for the current year — we don't claim
 * you watched something you haven't).
 */
export function watchedAgo(iso: string | null | undefined, opts?: { short?: boolean }): string | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;

  const days = Math.floor((Date.now() - then) / 86_400_000);
  if (days < 0) return null;

  // Compact form for a narrow poster (mobile), where "2 weeks ago" is heavier than the card can
  // carry: "Today · 3d · 2w · 1mo · 1y". Same thresholds, fewer pixels.
  if (opts?.short) {
    if (days === 0) return "Today";
    if (days < 7) return `${days}d`;
    if (days < 30) return `${Math.floor(days / 7)}w`;
    if (days < 365) return `${Math.floor(days / 30)}mo`;
    return `${Math.floor(days / 365)}y`;
  }

  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 14) return "Last week";
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 60) return "Last month";
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  const years = Math.floor(days / 365);
  return years === 1 ? "Last year" : `${years} years ago`;
}

/**
 * A film in your watchlist that hasn't come out yet — the basis of the "Waiting for" rail.
 *
 * "Waiting for" is DERIVED, never stored: a film is waiting because its release date is in the FUTURE,
 * not because a flag was flipped. The day it releases it crosses the line on its own and rejoins plain
 * "Want to Watch" — no trigger, no move. `release_date` is the truth; rows that predate the column fall
 * back to the TMDB `status` snapshot taken at add time ("Released" or not).
 */
export function isAwaitingRelease(item: {
  type: string;
  release_date?: string | null;
  status?: string | null;
  year?: number | null;
}): boolean {
  if (item.type !== "film") return false;
  if (item.release_date) return new Date(item.release_date).getTime() > Date.now();
  // Legacy rows with no stored date: fall back to the TMDB status snapshot, then to a coarse
  // future-year guard. This is THE single "is a film out?" predicate — the Waiting for rail and the
  // "can I mark it watched?" guard both read it, so they can never disagree.
  if (item.status) return item.status.toLowerCase() !== "released";
  return item.year != null && item.year > new Date().getFullYear();
}

/**
 * How long until a film comes out, the way a person would say it — the cue on a Waiting for card.
 * Null when the date is unknown (legacy row) or already past. Short form for the narrow mobile poster.
 */
export function releaseCountdown(
  dateStr: string | null | undefined,
  opts?: { short?: boolean },
): string | null {
  if (!dateStr) return null;
  const rel = new Date(dateStr).getTime();
  if (Number.isNaN(rel)) return null;
  const days = Math.ceil((rel - Date.now()) / 86_400_000);
  if (days <= 0) return null;

  if (opts?.short) {
    if (days < 7) return `${days}d`;
    if (days < 30) return `${Math.round(days / 7)}w`;
    if (days < 365) return `${Math.round(days / 30)}mo`;
    return `${Math.round(days / 365)}y`;
  }
  if (days === 1) return "Tomorrow";
  if (days < 7) return `${days} days`;
  if (days < 14) return "Next week";
  if (days < 30) return `${Math.round(days / 7)} weeks`;
  if (days < 60) return "Next month";
  if (days < 365) return `${Math.round(days / 30)} months`;
  const years = Math.round(days / 365);
  return years === 1 ? "Next year" : `${years} years`;
}
