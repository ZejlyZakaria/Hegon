import { seriesState } from "./series-state";
import type { AwardCategory, AwardEntry, AwardRow, WatchingMedia } from "../types";

/**
 * THE MUSEUM's arithmetic — pure, no React, no I/O.
 *
 * `watching.awards` keeps one line per CREDIT (Best Sound 2024 → four names, four rows). Every
 * surface shows TITLES, so the first thing any of them does is fold the rows of one (category,
 * year, work) into one entry with its people. The second thing is to ask the library whether it
 * owns that title — by TMDB id, the only join there is.
 */

export const workKey = (type: "film" | "serie", tmdbId: number | null) => `${type}:${tmdbId ?? "?"}`;

/**
 * `perPerson` = the PORTRAIT categories (acting, directing): there a nomination IS a person, so four
 * nominated actresses of one show are four entries — while the co-writers of one screenplay
 * nomination (not in the set) stay one entry with several names.
 */
export function foldEntries(rows: AwardRow[], perPerson: ReadonlySet<string> = new Set()): AwardEntry[] {
  const out = new Map<string, AwardEntry>();
  for (const r of rows) {
    // An unresolved title (no TMDB id) folds on its own row key instead, so two of them never merge.
    // `won` is part of the key: Aaron Paul (winner) and Giancarlo Esposito (nominee), same show,
    // same category, same year, are TWO nominations — while co-writers of one nomination share
    // one `won` and stay one entry.
    const who = perPerson.has(r.category) && r.person_qid ? `|${r.person_qid}` : "";
    const key = `${r.ceremony}|${r.category}|${r.year}|${r.won ? "W" : "N"}|${r.work_tmdb_id ? workKey(r.work_type, r.work_tmdb_id) : r.work_qid}${who}`;
    let e = out.get(key);
    if (!e) {
      e = {
        key, ceremony: r.ceremony, category: r.category, year: r.year, won: r.won,
        work_tmdb_id: r.work_tmdb_id, work_type: r.work_type, work_title: r.work_title,
        poster_path: r.poster_path, work_year: r.work_year, season_number: r.season_number, season_poster_path: r.season_poster_path, people: [],
      };
      out.set(key, e);
    }
    if (r.person_name && !e.people.some((p) => p.name === r.person_name)) {
      e.people.push({ tmdb_id: r.person_tmdb_id, name: r.person_name, profile_path: r.person_profile_path });
    }
  }
  return [...out.values()];
}

/** The library keyed the way the canon can ask for it. */
/** The category keys that fold per person. */
export const portraitKeys = (cats: { key: string; portrait: boolean }[]) => new Set(cats.filter((c) => c.portrait).map((c) => c.key));

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
  e.work_tmdb_id ? owned.get(workKey(e.work_type, e.work_tmdb_id)) ?? null : null;

/**
 * "Seen" for the museum = you have seen everything there is: finished, or CAUGHT UP on a show that
 * is still running (Widow's Bay, S1 complete, S2 not aired — you have seen the performance that
 * won). On the watchlist, in progress behind the air date, dropped: not yet.
 */
export const isSeen = (o: WatchingMedia | null) =>
  !!o && (o.watched || (o.type !== "film" && o.in_progress && seriesState(o) === "caught-up"));

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

/**
 * What the library says about a canon title, in the LIST DETAIL's words (its non-poster view:
 * a dot and a label) — the same object read on two pages must be described the same way.
 * The filter buckets are coarser than the labels: "In Progress" and "Dropped" file under
 * Unwatched (you have not finished it), the label still tells the exact truth on the tile.
 */
export type CanonBucket = "watched" | "want" | "unwatched";
export interface CanonStatus { bucket: CanonBucket; label: string; dotClass: string; textClass: string }

export function canonStatus(o: WatchingMedia | null): CanonStatus {
  if (o?.watched) return { bucket: "watched", label: "Watched", dotClass: "bg-emerald-400", textClass: "text-emerald-400" };
  if (isSeen(o)) return { bucket: "watched", label: "Caught up", dotClass: "bg-emerald-400", textClass: "text-emerald-400" };
  if (o?.want_to_watch) return { bucket: "want", label: "Want to Watch", dotClass: "bg-zinc-500", textClass: "text-zinc-400" };
  if (o?.in_progress) return { bucket: "unwatched", label: "In Progress", dotClass: "bg-accent-watching-vivid", textClass: "text-accent-watching-vivid" };
  if (o?.dropped) return { bucket: "unwatched", label: "Dropped", dotClass: "bg-red-500", textClass: "text-red-400" };
  if (o?.paused) return { bucket: "unwatched", label: "Paused", dotClass: "bg-amber-400", textClass: "text-amber-400" };
  return { bucket: "unwatched", label: "Unwatched", dotClass: "bg-zinc-600", textClass: "text-zinc-500" };
}
