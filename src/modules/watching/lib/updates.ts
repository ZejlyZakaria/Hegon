import { buildMediaView, type MediaViewSource } from "./media-view";
import { hasViewingEngagement, isFinished } from "./series-state";
import type { AnimeCoursRow, WatchingMedia } from "../types";
import type { RewatchCatalogue } from "./rewatch";

export type UpdatesMedia = MediaViewSource & Pick<WatchingMedia,
  "id" | "tmdb_id" | "title" | "poster_url" | "backdrop_url" | "personal_revision" | "watched" | "in_progress" |
  "paused" | "dropped" | "want_to_watch" | "is_reference" | "favorite" | "season_air_dates" | "release_date" | "year"
>;
export interface UpdatesData {
  items: UpdatesMedia[];
  cours: AnimeCoursRow[];
  catalogues: { work_key: string; facts: Pick<RewatchCatalogue, "seasons"> }[];
}
export interface WatchingUpdate {
  id: string;
  media: UpdatesMedia;
  scope: string;
  poster: string | null;
  state: "available" | "upcoming" | "tba";
  date: string | null;
  episodes: number;
  fullSeason: boolean;
  episodeFrom: number | null;
  episodeTo: number | null;
}

/** Calendar dates only; no invented January 1 or use of a release date as a viewing date. */
function calendarDate(value: string | null | undefined): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : null;
}

/** The catalogue lens is shared by candidate reads and final classification. */
function pendingScopes(data: UpdatesData) {
  const cours = new Map(data.cours.map(row => [row.tmdb_id, row]));
  return data.items.flatMap(media => {
    if (media.type === "film" || media.is_reference || !media.want_to_watch && !hasViewingEngagement(media)) return [];
    const view = buildMediaView(media, cours.get(media.tmdb_id));
    if (!media.want_to_watch && view.position.season <= 1 && view.position.episode <= 0) return [];
    return view.seasons.flatMap(season => {
      const scopes = season.parts && season.parts.length > 1
        ? season.parts.map(part => ({ key: `anilist:${part.id}`, label: `Season ${season.season} · Part ${part.number}`, from: part.from, to: part.to }))
        : [{ key: view.overlaid ? `anilist:${view.cours![season.season - 1].anilist_id}` : `season:${season.season}`, label: `Season ${season.season}`, from: 1, to: season.episodes }];
      const watched = media.want_to_watch ? 0 : view.position.season > season.season ? Infinity : view.position.season === season.season ? view.position.episode : 0;
      return scopes.filter(scope => watched < (scope.to || Infinity)).map(scope => ({ media, view, season, scope, watched }));
    });
  });
}

/** Batch evidence for remaining scopes, including weekly episodes and TV, before date filtering. */
export function updatesCatalogueWorkKeys(data: UpdatesData): string[] {
  return [...new Set(pendingScopes(data).map(({ media }) => `tv:${media.tmdb_id}`))];
}

/** Paused announcements remain useful; dropped works are excluded from release news. */
export function isUpdateVisible(update: WatchingUpdate): boolean {
  return !update.media.dropped && (!update.media.paused || update.state !== "available");
}

/** One evolving release card per season/accepted part, never an old-backlog feed. */
export function buildWatchingUpdates(data: UpdatesData, today: string): WatchingUpdate[] {
  const catalogues = new Map(data.catalogues.map(row => [row.work_key, row.facts]));
  const result: WatchingUpdate[] = [];
  const cutoff = new Date(`${today}T12:00:00Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() - 30);
  const recentFrom = cutoff.toISOString().slice(0, 10);
  for (const { media, view, season, scope, watched } of pendingScopes(data)) {
    const catalogue = catalogues.get(`tv:${media.tmdb_id}`);
    const members = catalogue?.seasons.flatMap(s => s.episodes.map(e => ({ ...e, display: view.fromStorage(s.number, e.number) })))
      .filter(e => e.display.season === season.season && e.display.episode >= scope.from && (!scope.to || e.display.episode <= scope.to)) ?? [];
    const first = members.find(e => e.display.episode === scope.from);
    const projectedDate = scope.from === 1 && !view.overlaid ? media.season_air_dates?.[season.season - 1] : null;
    const premiere = calendarDate(first?.air_date) ?? calendarDate(projectedDate);
    // Dated accepted episodes are authoritative, even when the projected aired prefix is stale.
    const released = members.filter(e => e.aired !== false && calendarDate(e.air_date) && e.air_date! <= today);
    const unseen = released.filter(e => e.display.episode > watched);
    const projectedAired = season.airedKnown !== false ? Math.max(0, Math.min(season.aired, scope.to || season.aired) - Math.max(scope.from - 1, watched)) : 0;
    const hasReleased = released.length > 0 || projectedAired > 0;
    if (!hasReleased && (isFinished(media.status) || watched >= scope.from)) continue;
    let state: WatchingUpdate["state"] = premiere && premiere > today ? "upcoming" : "tba";
    let date = premiere;
    let fullSeason = false;
    if (hasReleased) {
      // Unknown dates cannot prove freshness. Never substitute a robot check or personal edit date.
      const airing = members.some(e => { const date = calendarDate(e.air_date); return date != null && date > today; });
      if (!unseen.length || !airing && !released.some(e => e.air_date! >= recentFrom)) continue;
      state = "available";
      date = released.map(e => e.air_date!).sort().at(-1)!;
      const expected = scope.to - scope.from + 1;
      fullSeason = scope.to > 0 && released.length === expected && new Set(released.map(e => e.display.episode)).size === expected;
    }
    const numbers = unseen.map(e => e.display.episode).sort((a, b) => a - b);
    result.push({ id: `${media.id}:${scope.key}`, media, scope: scope.label, poster: season.poster ?? media.poster_url,
      state, date, episodes: unseen.length, fullSeason, episodeFrom: numbers[0] ?? null, episodeTo: numbers.at(-1) ?? null });
  }
  const rank = { available: 0, upcoming: 1, tba: 2 };
  return result.sort((a, b) => rank[a.state] - rank[b.state] ||
    (a.state === "tba" && b.state === "tba" ? Number(!!a.media.want_to_watch) - Number(!!b.media.want_to_watch) : 0) ||
    (a.state === "available" ? (b.date ?? "").localeCompare(a.date ?? "") : (a.date ?? "9999").localeCompare(b.date ?? "9999")) ||
    a.media.title.localeCompare(b.media.title) || a.id.localeCompare(b.id));
}
