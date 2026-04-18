import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as HabitService from "../service";
import { HABIT_KEYS } from "./query-keys";
import { toast } from "@/shared/utils/toast";
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
  return useMutation({
    mutationFn: (input: CreateHabitInput) => HabitService.createHabit(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: HABIT_KEYS.lists() });
      toast.success("Habit created.");
    },
    onError: () => {
      toast.error("Failed to create habit.");
    },
  });
}

export function useUpdateHabit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateHabitInput) => HabitService.updateHabit(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: HABIT_KEYS.lists() });
    },
    onError: () => {
      toast.error("Failed to update habit.");
    },
  });
}

export function useArchiveHabit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => HabitService.archiveHabit(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: HABIT_KEYS.lists() });
      toast.success("Habit archived.");
    },
    onError: () => {
      toast.error("Failed to archive habit.");
    },
  });
}

export function useDeleteHabit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => HabitService.deleteHabit(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: HABIT_KEYS.lists() });
      toast.success("Habit deleted.");
    },
    onError: (error: Error) => {
      toast.error(error.message ?? "Failed to delete habit.");
    },
  });
}
