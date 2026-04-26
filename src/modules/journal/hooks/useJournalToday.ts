import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as JournalService from "../service";
import { JOURNAL_KEYS } from "./query-keys";
import { toast } from "@/shared/utils/toast";
import type { CreateJournalEntryInput, UpdateJournalEntryInput } from "../types";

export function useJournalToday() {
  return useQuery({
    queryKey: JOURNAL_KEYS.today(),
    queryFn:  () => JournalService.getTodayEntry(),
    staleTime: 1000 * 60 * 5,
  });
}

export function useCreateEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateJournalEntryInput) => JournalService.createEntry(input),
    onSuccess: (entry) => {
      queryClient.invalidateQueries({ queryKey: JOURNAL_KEYS.today() });
      queryClient.invalidateQueries({ queryKey: JOURNAL_KEYS.list() });
      queryClient.invalidateQueries({ queryKey: JOURNAL_KEYS.streak() });
      queryClient.invalidateQueries({
        queryKey: JOURNAL_KEYS.calendar(
          new Date(entry.entry_date).getFullYear(),
          new Date(entry.entry_date).getMonth() + 1
        ),
      });
    },
    onError: () => {
      toast.error("Failed to save entry.");
    },
  });
}

export function useUpdateEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateJournalEntryInput) => JournalService.updateEntry(input),
    onSuccess: (entry) => {
      queryClient.invalidateQueries({ queryKey: JOURNAL_KEYS.today() });
      queryClient.invalidateQueries({ queryKey: JOURNAL_KEYS.byDate(entry.entry_date) });
      queryClient.invalidateQueries({ queryKey: JOURNAL_KEYS.list() });
      queryClient.invalidateQueries({
        queryKey: JOURNAL_KEYS.calendar(
          new Date(entry.entry_date).getFullYear(),
          new Date(entry.entry_date).getMonth() + 1
        ),
      });
    },
    onError: () => {
      toast.error("Failed to update entry.");
    },
  });
}

export function useDeleteEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; entryDate: string }) => JournalService.deleteEntry(id),
    onSuccess: (_, { entryDate }) => {
      const d = new Date(entryDate + "T00:00:00");
      queryClient.invalidateQueries({ queryKey: JOURNAL_KEYS.today() });
      queryClient.invalidateQueries({ queryKey: JOURNAL_KEYS.list() });
      queryClient.invalidateQueries({ queryKey: JOURNAL_KEYS.streak() });
      queryClient.invalidateQueries({ queryKey: JOURNAL_KEYS.calendar(d.getFullYear(), d.getMonth() + 1) });
      toast.success("Entry deleted.");
    },
    onError: () => {
      toast.error("Failed to delete entry.");
    },
  });
}
