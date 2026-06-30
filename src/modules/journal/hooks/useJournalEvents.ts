import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as JournalService from "../service";
import { JOURNAL_KEYS } from "./query-keys";
import { toast } from "@/shared/utils/toast";
import { useIsDemo } from "@/modules/settings/hooks/useSettings";
import { DemoReadOnlyError, handledDemoError } from "@/shared/utils/demo-guard";
import type { CreateJournalEventInput } from "../types";

export function useEventsForMonth(year: number, month: number) {
  return useQuery({
    queryKey: JOURNAL_KEYS.events(year, month),
    queryFn:  () => JournalService.getEventsForMonth(year, month),
    staleTime: 1000 * 60 * 5,
  });
}

export function useUpcomingEvents(limit = 5) {
  return useQuery({
    queryKey: JOURNAL_KEYS.upcomingEvents(),
    queryFn:  () => JournalService.getUpcomingEvents(limit),
    staleTime: 1000 * 60 * 5,
  });
}

function invalidateEvents(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: [...JOURNAL_KEYS.all, "events"] });
}

export function useCreateEvent() {
  const queryClient = useQueryClient();
  const isDemo = useIsDemo();
  return useMutation({
    mutationFn: (input: CreateJournalEventInput) => {
      if (isDemo) throw new DemoReadOnlyError();
      return JournalService.createEvent(input);
    },
    onSuccess: () => {
      invalidateEvents(queryClient);
      toast.success("Event added.");
    },
    onError: (error) => { if (handledDemoError(error)) return; toast.error("Failed to add event."); },
  });
}

export function useDeleteEvent() {
  const queryClient = useQueryClient();
  const isDemo = useIsDemo();
  return useMutation({
    mutationFn: (id: string) => {
      if (isDemo) throw new DemoReadOnlyError();
      return JournalService.deleteEvent(id);
    },
    onSuccess: () => invalidateEvents(queryClient),
    onError: (error) => { if (handledDemoError(error)) return; toast.error("Failed to remove event."); },
  });
}
