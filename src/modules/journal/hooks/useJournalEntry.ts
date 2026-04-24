import { useQuery } from "@tanstack/react-query";
import * as JournalService from "../service";
import { JOURNAL_KEYS } from "./query-keys";

export function useJournalEntry(date: string) {
  return useQuery({
    queryKey: JOURNAL_KEYS.byDate(date),
    queryFn:  () => JournalService.getEntry(date),
    staleTime: 1000 * 60 * 5,
    enabled: !!date,
  });
}

export function useJournalEntries(opts?: {
  search?: string;
  mood?: string;
  limit?: number;
  offset?: number;
}) {
  return useQuery({
    queryKey: JOURNAL_KEYS.list(opts),
    queryFn:  () => JournalService.getEntries(opts),
    staleTime: 1000 * 60 * 2,
  });
}
