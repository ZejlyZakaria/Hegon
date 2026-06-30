import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as HabitService from "../service";
import { HABIT_KEYS } from "./query-keys";
import { toast } from "@/shared/utils/toast";
import { useIsDemo } from "@/modules/settings/hooks/useSettings";
import { DemoReadOnlyError, handledDemoError } from "@/shared/utils/demo-guard";
import type { CreateHabitInput, UpdateHabitInput } from "../types";

export function useHabits() {
  return useQuery({
    queryKey: HABIT_KEYS.lists(),
    queryFn:  () => HabitService.getHabits(),
    staleTime: 1000 * 60 * 5,
  });
}

export function useCreateHabit() {
  const queryClient = useQueryClient();
  const isDemo = useIsDemo();
  return useMutation({
    mutationFn: (input: CreateHabitInput) => {
      if (isDemo) throw new DemoReadOnlyError();
      return HabitService.createHabit(input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: HABIT_KEYS.lists() });
      toast.success("Habit created.");
    },
    onError: (error) => {
      if (handledDemoError(error)) return;
      toast.error("Failed to create habit.");
    },
  });
}

export function useUpdateHabit() {
  const queryClient = useQueryClient();
  const isDemo = useIsDemo();
  return useMutation({
    mutationFn: (input: UpdateHabitInput) => {
      if (isDemo) throw new DemoReadOnlyError();
      return HabitService.updateHabit(input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: HABIT_KEYS.lists() });
      toast.success("Habit updated.");
    },
    onError: (error) => {
      if (handledDemoError(error)) return;
      toast.error("Failed to update habit.");
    },
  });
}

export function useArchiveHabit() {
  const queryClient = useQueryClient();
  const isDemo = useIsDemo();
  return useMutation({
    mutationFn: (id: string) => {
      if (isDemo) throw new DemoReadOnlyError();
      return HabitService.archiveHabit(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: HABIT_KEYS.all });
      toast.success("Habit archived.");
    },
    onError: (error) => {
      if (handledDemoError(error)) return;
      toast.error("Failed to archive habit.");
    },
  });
}

export function useDeleteHabit() {
  const queryClient = useQueryClient();
  const isDemo = useIsDemo();
  return useMutation({
    mutationFn: (id: string) => {
      if (isDemo) throw new DemoReadOnlyError();
      return HabitService.deleteHabit(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: HABIT_KEYS.all });
      toast.success("Habit deleted.");
    },
    onError: (error: Error) => {
      if (handledDemoError(error)) return;
      toast.error(error.message ?? "Failed to delete habit.");
    },
  });
}

export function useArchivedHabits() {
  return useQuery({
    queryKey: HABIT_KEYS.archived(),
    queryFn:  () => HabitService.getArchivedHabits(),
    staleTime: 1000 * 60 * 5,
  });
}

export function useUnarchiveHabit() {
  const queryClient = useQueryClient();
  const isDemo = useIsDemo();
  return useMutation({
    mutationFn: (id: string) => {
      if (isDemo) throw new DemoReadOnlyError();
      return HabitService.unarchiveHabit(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: HABIT_KEYS.all });
      toast.success("Habit restored.");
    },
    onError: (error) => {
      if (handledDemoError(error)) return;
      toast.error("Failed to restore habit.");
    },
  });
}

export function useDeleteHabitPermanently() {
  const queryClient = useQueryClient();
  const isDemo = useIsDemo();
  return useMutation({
    mutationFn: (id: string) => {
      if (isDemo) throw new DemoReadOnlyError();
      return HabitService.deleteHabitPermanently(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: HABIT_KEYS.all });
      toast.success("Habit deleted.");
    },
    onError: (error) => {
      if (handledDemoError(error)) return;
      toast.error("Failed to delete habit.");
    },
  });
}
