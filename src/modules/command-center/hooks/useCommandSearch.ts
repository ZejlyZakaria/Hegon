"use client";

import { useQuery } from "@tanstack/react-query";
import { useDebounce } from "@/shared/hooks/useDebounce";
import { searchAll } from "../service";
import { STALE } from "@/shared/lib/stale";

export function useCommandSearch(query: string) {
  const debouncedQuery = useDebounce(query, 200);

  return useQuery({
    queryKey: ["command-center", "search", debouncedQuery],
    queryFn:  () => searchAll(debouncedQuery),
    enabled:  debouncedQuery.length >= 2,
    staleTime: STALE.HALF_MINUTE,
  });
}
