"use client";

import { useMemo } from "react";
import { useBooks } from "../hooks/useBooks";
import { BookCard } from "./BookCard";
import type { BookStatus, BookSort } from "../types";

interface BooksSectionProps {
  status?:       BookStatus;
  sort?:         BookSort;
  search?:       string;
  emptyMessage?: string;
}

export function BooksSection({
  status,
  sort,
  search = "",
  emptyMessage = "No books found",
}: BooksSectionProps) {
  const { data: allBooks, isLoading } = useBooks({ status, sort });

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
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-32 bg-surface-1 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (books.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-32 gap-2">
        <span className="text-xs text-text-tertiary">
          {search.trim() ? "No books match your search." : emptyMessage}
        </span>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {books.map((book) => (
        <BookCard key={book.id} book={book} />
      ))}
    </div>
  );
}
