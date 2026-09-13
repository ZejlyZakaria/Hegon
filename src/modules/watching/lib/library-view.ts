import type { WatchingMedia } from "../types";

// The Library grid's whole pipeline — type filter, status filter, favourites, title search, sort,
// pagination — as ONE pure function. It lived for months inside a `useMemo` in `LibraryClient`,
// fifty lines of decisions nobody could test without mounting the page (audit 2026-09-13, axis 5:
// the contre-examen caught it hiding behind "what's left in components is three-line formatters").

export type LibraryTypeFilter = "all" | "film" | "serie" | "anime";
export type LibraryStatusFilter = "all" | "watching" | "paused" | "completed" | "dropped";
export type LibrarySortKey = "added" | "rating" | "title" | "year" | "favorite";

export interface LibraryQuery {
  type: LibraryTypeFilter;
  status: LibraryStatusFilter;
  sort: LibrarySortKey;
  /** Already debounced by the caller. Matched against the title and the original title, never tags. */
  search: string;
  /** 1-based. Out-of-range pages are clamped, never empty. */
  page: number;
  pageSize: number;
}

export type LibraryRow = Pick<
  WatchingMedia,
  "type" | "title" | "original_title" | "favorite" | "user_rating" | "year" | "watched_at" | "updated_at"
  | "in_progress" | "paused" | "watched" | "dropped"
>;

/** The status a row must carry to pass a status filter — one place, so the chips and the grid agree. */
export function matchesStatus(item: LibraryRow, status: LibraryStatusFilter): boolean {
  switch (status) {
    case "watching":  return !!item.in_progress;
    case "paused":    return !!item.paused;
    case "completed": return !!item.watched;
    case "dropped":   return !!item.dropped;
    default:          return true;
  }
}

/** Newest activity first: a watch date, else the row's last update (in-progress / dropped rows have no watch date). */
function activityTime(item: LibraryRow): number {
  return new Date(item.watched_at || item.updated_at || 0).getTime();
}

export function compareLibrary(sort: LibrarySortKey): (a: LibraryRow, b: LibraryRow) => number {
  switch (sort) {
    case "rating": return (a, b) => (b.user_rating || 0) - (a.user_rating || 0);
    case "title":  return (a, b) => a.title.localeCompare(b.title);
    case "year":   return (a, b) => (b.year || 0) - (a.year || 0);
    // "added" and "favorite" both read as recency — "favorite" is a FILTER that keeps the default order.
    default:       return (a, b) => activityTime(b) - activityTime(a);
  }
}

export function queryLibrary<T extends LibraryRow>(
  allItems: readonly T[],
  q: LibraryQuery,
): { items: T[]; totalCount: number; totalPages: number; page: number } {
  let result = allItems.filter((item) => q.type === "all" || item.type === q.type);
  if (q.status !== "all") result = result.filter((item) => matchesStatus(item, q.status));
  if (q.sort === "favorite") result = result.filter((item) => item.favorite === true);

  // TITLE only — not genres. Searching `tags` too meant "fantas" matched every Fantasy-tagged
  // title (GoT, HotD, most anime): ~80 "impossible" results for a three-word query. A title box
  // must search titles; genre belongs to a filter, not to free text where a substring of
  // "Fantasy" silently floods the grid.
  const needle = q.search.trim().toLowerCase();
  if (needle) {
    result = result.filter(
      (item) => item.title.toLowerCase().includes(needle) || item.original_title?.toLowerCase().includes(needle),
    );
  }

  result = [...result].sort(compareLibrary(q.sort));

  const totalCount = result.length;
  const pageSize   = Math.max(1, q.pageSize);
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const page       = Math.min(Math.max(1, q.page), totalPages);
  const start      = (page - 1) * pageSize;
  return { items: result.slice(start, start + pageSize), totalCount, totalPages, page };
}
