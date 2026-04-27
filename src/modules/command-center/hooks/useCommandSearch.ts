"use client";

import { useQuery } from "@tanstack/react-query";
import { useDebounce } from "@/shared/hooks/useDebounce";
import { searchAll } from "../service";

export function useCommandSearch(query: string) {
  const debouncedQuery = useDebounce(query, 200);

  return useQuery({
    queryKey: ["command-center", "search", debouncedQuery],
    queryFn:  () => searchAll(debouncedQuery),
    enabled:  debouncedQuery.length >= 2,
    staleTime: 1000 * 30,
  });
}
