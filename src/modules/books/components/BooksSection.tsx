"use client";

import { useState } from "react";
import { Search, X } from "lucide-react";
import { useDebounce } from "@/shared/hooks/useDebounce";
import { Input } from "@/shared/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { useBooks } from "../hooks/useBooks";
import { BookCard } from "./BookCard";
import type { BookStatus, BookSort } from "../types";

interface BooksSectionProps {
  status?: BookStatus;
  showSearch?: boolean;
  showSort?: boolean;
  emptyMessage?: string;
}

const SORT_OPTIONS: Array<{ value: BookSort; label: string }> = [
  { value: "recently_added", label: "Recently Added" },
  { value: "title",          label: "Title" },
  { value: "rating",         label: "Rating" },
  { value: "most_read",      label: "Most Read" },
];

export function BooksSection({
  status,
  showSearch = false,
  showSort = false,
  emptyMessage = "No books found",
}: BooksSectionProps) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<BookSort>("recently_added");

  const debouncedSearch = useDebounce(search, 300);

  const { data: books, isLoading } = useBooks({
    status,
    search: debouncedSearch || undefined,
    sort,
  });

  return (
    <div className="flex flex-col h-full gap-4">
      {(showSearch || showSort) && (
        <div className="flex items-center gap-2">
          {showSearch && (
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#71717a] pointer-events-none" />
              <Input
                variant="tasks"
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search books..."
                className="pl-9 pr-9 bg-surface-1 hover:bg-surface-2 border-border-subtle focus:border-border-focus"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#71717a] hover:text-[#a0a0a8] transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          {showSort && (
            <Select value={sort} onValueChange={(v) => setSort(v as BookSort)}>
              <SelectTrigger
                variant="tasks"
                size="sm"
                className="w-36 shrink-0 bg-surface-2 focus:border-border-focus"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent variant="tasks">
                {SORT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-32 bg-surface-1 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : books?.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 gap-2">
            <span className="text-xs text-text-tertiary">{emptyMessage}</span>
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="text-xs transition-opacity hover:opacity-80"
                style={{ color: "#0ea5e9" }}
              >
                Clear search
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {books?.map((book) => (
              <BookCard key={book.id} book={book} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
