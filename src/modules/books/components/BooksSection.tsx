"use client";

import { useMemo } from "react";
import { useBooks } from "../hooks/useBooks";
import { FadeIn } from "@/shared/components/ui/motion";
import { BookCard } from "./BookCard";
import { BookRow } from "./BookRow";
import { BookCardSkeleton, BookRowSkeleton } from "./BooksSkeleton";
import type { BookStatus, BookSort } from "../types";

// Browse tabs have no right panel (it's Reading-only) → full-width grid, matching
// Watching's library density.
const GRID = "grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10";
const ROWS = "grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3";

interface BooksSectionProps {
  status?:       BookStatus;
  sort?:         BookSort;
  search?:       string;
  favorite?:     boolean;
  emptyMessage?: string;
}

export function BooksSection({
  status,
  sort,
  search = "",
  favorite,
  emptyMessage = "No books found",
}: BooksSectionProps) {
  const { data: allBooks, isLoading } = useBooks({ status, sort, favorite });

  // "Reading" is a tracking view → info-rich rows. Everything else is a
  // browse/collection view → cover grid.
  const isReading = status === "reading";

  // Client-side filter — no re-fetch, no loading flash on keystroke
  const books = useMemo(() => {
    if (!allBooks) return [];
    if (!search.trim()) return allBooks;
    const q = search.toLowerCase();
    return allBooks.filter(
      (b) =>
        b.title.toLowerCase().includes(q) ||
        (b.author ?? "").toLowerCase().includes(q),
    );
  }, [allBooks, search]);

  if (isLoading) {
    return isReading ? (
      <div className={ROWS}>
        {Array.from({ length: 3 }).map((_, i) => <BookRowSkeleton key={i} />)}
      </div>
    ) : (
      <div className={GRID}>
        {Array.from({ length: 14 }).map((_, i) => <BookCardSkeleton key={i} />)}
      </div>
    );
  }

  if (books.length === 0) {
    return (
      <div className="flex h-32 flex-col items-center justify-center gap-2">
        <span className="text-xs text-text-tertiary">
          {search.trim() ? "No books match your search." : emptyMessage}
        </span>
      </div>
    );
  }

  // Keyed by tab → the grid/list fades in cleanly on each tab switch, with NO exit
  // animation (the old tab's items unmount instantly instead of "flying out", which
  // looked busy on a dense cover grid). Search within a tab doesn't re-animate.
  return (
    <FadeIn key={isReading ? "reading" : (status ?? "all")} className={isReading ? ROWS : GRID}>
      {books.map((book) =>
        isReading ? <BookRow key={book.id} book={book} /> : <BookCard key={book.id} book={book} />,
      )}
    </FadeIn>
  );
}
