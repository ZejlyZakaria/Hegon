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
