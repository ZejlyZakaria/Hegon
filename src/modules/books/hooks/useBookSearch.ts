import { useQuery } from "@tanstack/react-query";
import { useDebounce } from "@/shared/hooks/useDebounce";
import { BOOK_KEYS } from "./query-keys";
import type { BookSearchResult } from "../types";

async function searchGoogleBooks(query: string): Promise<BookSearchResult[]> {
  const res = await fetch(`/api/books/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error("Search failed");
  return res.json();
}

export function useBookSearch(query: string) {
  const debouncedQuery = useDebounce(query.trim(), 400);

  return useQuery({
    queryKey: BOOK_KEYS.search(debouncedQuery),
    queryFn:  () => searchGoogleBooks(debouncedQuery),
    enabled:  debouncedQuery.length >= 2,
    staleTime: 1000 * 60 * 10,  // search results cached 10min
  });
}
