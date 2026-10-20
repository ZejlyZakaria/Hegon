/** Availability of content, independent of library posture or provider lifecycle labels. */
export interface WatchableFacts {
  type?: string | null;
  release_date?: string | null;
  first_air_date?: string | null;
  season_air_dates?: (string | null)[] | null;
  season_aired?: number[] | null;
  year?: number | null;
  watched?: boolean;
  current_episode?: number | null;
}

export function isWatchableNow(media: WatchableFacts, now = new Date()): boolean {
  const available = (date: string | null | undefined) => {
    if (!date) return false;
    const timestamp = Date.parse(date);
    return Number.isFinite(timestamp) && timestamp <= now.getTime();
  };
  if (media.type !== "film" && media.season_aired != null) {
    // Known zero overrides dates and personal claims; announcements never prove availability.
    return media.season_aired.some((count) => count > 0);
  }
  const premiere = media.type === "film" ? media.release_date
    : media.first_air_date ?? media.season_air_dates?.find((date) => date != null);
  if (premiere) return available(premiere);
  // Incomplete legacy rows: an earlier release year or actual personal consumption is evidence.
  // A current/future year or a lifecycle label alone is not enough.
  return (media.year != null && media.year < now.getFullYear())
    || media.watched === true || (media.current_episode ?? 0) > 0;
}
