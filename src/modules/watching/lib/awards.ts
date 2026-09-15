import type { AwardCategory, AwardEntry, AwardRow, WatchingMedia } from "../types";

/**
 * THE MUSEUM's arithmetic — pure, no React, no I/O.
 *
 * `watching.awards` keeps one line per CREDIT (Best Sound 2024 → four names, four rows). Every
 * surface shows TITLES, so the first thing any of them does is fold the rows of one (category,
 * year, work) into one entry with its people. The second thing is to ask the library whether it
 * owns that title — by TMDB id, the only join there is.
 */

export const workKey = (type: "film" | "serie", tmdbId: number) => `${type}:${tmdbId}`;

export function foldEntries(rows: AwardRow[]): AwardEntry[] {
  const out = new Map<string, AwardEntry>();
  for (const r of rows) {
    const key = `${r.ceremony}|${r.category}|${r.year}|${workKey(r.work_type, r.work_tmdb_id)}`;
    let e = out.get(key);
    if (!e) {
      e = {
        key, ceremony: r.ceremony, category: r.category, year: r.year, won: r.won,
        work_tmdb_id: r.work_tmdb_id, work_type: r.work_type, work_title: r.work_title,
        poster_path: r.poster_path, work_year: r.work_year, people: [],
      };
      out.set(key, e);
    }
    e.won = e.won || r.won;
    if (r.person_name && !e.people.some((p) => p.name === r.person_name)) {
      e.people.push({ tmdb_id: r.person_tmdb_id, name: r.person_name });
    }
  }
  return [...out.values()];
}

/** The library keyed the way the canon can ask for it. */
export function indexOwned(owned: WatchingMedia[]): Map<string, WatchingMedia> {
  const m = new Map<string, WatchingMedia>();
  for (const o of owned) {
    if (!o.tmdb_id) continue;
    // A series and an anime are both "serie" to Wikidata/TMDB TV.
    const type = o.type === "film" ? "film" : "serie";
    const k = workKey(type, o.tmdb_id);
    if (!m.has(k)) m.set(k, o);
  }
  return m;
}

export const ownedFor = (owned: Map<string, WatchingMedia>, e: Pick<AwardEntry, "work_type" | "work_tmdb_id">) =>
  owned.get(workKey(e.work_type, e.work_tmdb_id)) ?? null;

/** "Watched" for the museum = finished. In progress or on the watchlist does not count yet. */
export const isSeen = (o: WatchingMedia | null) => !!o && o.watched;

/**
 * The trophy shelf: your finished titles that WON something, one card per title, wearing its most
 * prestigious win (lowest category rank) and how many more it has.
 */
export interface ShelfItem {
  owned: WatchingMedia;
  entry: AwardEntry;
  /** Other wins of the same title, beyond the one shown. */
  more: number;
  /** Every category label this title won, best first. */
  labels: string[];
}

export function buildShelf(entries: AwardEntry[], owned: Map<string, WatchingMedia>, categories: AwardCategory[]): ShelfItem[] {
  const rank = new Map(categories.map((c) => [c.key, c.rank]));
  const label = new Map(categories.map((c) => [c.key, c.label]));
  const byWork = new Map<string, AwardEntry[]>();
  for (const e of entries) {
    if (!e.won) continue;
    const o = ownedFor(owned, e);
    if (!isSeen(o)) continue;
    const k = workKey(e.work_type, e.work_tmdb_id);
    byWork.set(k, [...(byWork.get(k) ?? []), e]);
  }
  const shelf: ShelfItem[] = [];
  for (const [k, wins] of byWork) {
    wins.sort((a, b) => (rank.get(a.category) ?? 99) - (rank.get(b.category) ?? 99) || b.year - a.year);
    shelf.push({ owned: owned.get(k)!, entry: wins[0], more: wins.length - 1, labels: wins.map((w) => label.get(w.category) ?? w.category) });
  }
  // Most recent win first — the shelf reads like the timeline does.
  return shelf.sort((a, b) => b.entry.year - a.entry.year);
}

/** Coverage of one category: winners seen / winners total (distinct titles, not credits). */
export function coverage(entries: AwardEntry[], owned: Map<string, WatchingMedia>, category: string) {
  const winners = entries.filter((e) => e.category === category && e.won);
  const seen = winners.filter((e) => isSeen(ownedFor(owned, e))).length;
  return { seen, total: winners.length };
}
