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

// Cross-module "Today's context" — what you did today across HEGON. Kept fresh:
// re-reads on every mount + window focus so returning to Journal reflects habits
// /films/pages logged elsewhere (staleTime 0 = no stale cache window).
export function useTodayContext() {
  return useQuery({
    queryKey: JOURNAL_KEYS.todayContext(),
    queryFn:  () => JournalService.getTodayContext(),
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });
}

// "On this day" — entries from the same date in previous years.
export function useOnThisDay() {
  return useQuery({
    queryKey: JOURNAL_KEYS.onThisDay(),
    queryFn:  () => JournalService.getOnThisDay(),
    staleTime: 1000 * 60 * 30,
  });
}
