import type { BookStatus, BookSort } from "../types";

export const BOOK_KEYS = {
  all:        ['books'] as const,
  list:       (opts?: { status?: BookStatus; search?: string; favorite?: boolean; sort?: BookSort }) =>
    [...BOOK_KEYS.all, 'list', opts ?? {}] as const,
  detail:     (id: string) => [...BOOK_KEYS.all, 'detail', id] as const,
  stats:      () => [...BOOK_KEYS.all, 'stats'] as const,
  rightPanel: () => [...BOOK_KEYS.all, 'right-panel'] as const,
  search:     (query: string) => [...BOOK_KEYS.all, 'search', query] as const,
} as const;
