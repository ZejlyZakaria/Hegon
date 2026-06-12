"use client";

import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useBooks } from "../hooks/useBooks";
import { BookCard } from "./BookCard";
import { BookRow } from "./BookRow";
import { BookCardSkeleton, BookRowSkeleton } from "./BooksSkeleton";
import type { BookStatus, BookSort } from "../types";

const GRID = "grid grid-cols-3 gap-x-4 gap-y-6 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-7";
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

  return (
    <div className={isReading ? ROWS : GRID}>
      <AnimatePresence mode="popLayout">
        {books.map((book, i) => (
          <motion.div
            key={book.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18, delay: i * 0.04, ease: "easeOut" }}
          >
            {isReading ? <BookRow book={book} /> : <BookCard book={book} />}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
