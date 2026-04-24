import { useQuery } from "@tanstack/react-query";
import * as JournalService from "../service";
import { JOURNAL_KEYS } from "./query-keys";

export function useJournalCalendar(year: number, month: number) {
  return useQuery({
    queryKey: JOURNAL_KEYS.calendar(year, month),
    queryFn:  () => JournalService.getCalendarData(year, month),
    staleTime: 1000 * 60 * 5,
  });
}

export function useJournalStreak() {
  return useQuery({
    queryKey: JOURNAL_KEYS.streak(),
    queryFn:  () => JournalService.getStreak(),
    staleTime: 1000 * 60 * 5,
  });
}
