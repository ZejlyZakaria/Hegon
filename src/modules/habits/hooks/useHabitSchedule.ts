import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as HabitService from "../service";
import { HABIT_KEYS } from "./query-keys";
import { toast } from "@/shared/utils/toast";
import { useIsDemo } from "@/modules/settings/hooks/useSettings";
import { DemoReadOnlyError, handledDemoError } from "@/shared/utils/demo-guard";

// ─── Queries (habit detail panel) ───────────────────────────────────────────────

export function useHabitSkips(habitId: string | null) {
  return useQuery({
    queryKey: HABIT_KEYS.skips(habitId ?? "none"),
    queryFn: () => HabitService.getHabitSkips(habitId as string),
    enabled: !!habitId,
    staleTime: 1000 * 60 * 5,
    retry: false,
  });
}

export function useHabitPauses(habitId: string | null) {
  return useQuery({
    queryKey: HABIT_KEYS.pauses(habitId ?? "none"),
    queryFn: () => HabitService.getHabitPauses(habitId as string),
    enabled: !!habitId,
    staleTime: 1000 * 60 * 5,
    retry: false,
  });
}

// Monthly freeze budget (streak protection).
export const MONTHLY_FREEZE_BUDGET = 3;

export function useHabitFreezes(habitId: string | null) {
  return useQuery({
    queryKey: HABIT_KEYS.freezes(habitId ?? "none"),
    queryFn: () => HabitService.getHabitFreezes(habitId as string),
    enabled: !!habitId,
    staleTime: 1000 * 60 * 5,
    retry: false,
  });
}

export function useMonthlyFreezeCount() {
  return useQuery({
    queryKey: HABIT_KEYS.freezes("month"),
    queryFn: () => HabitService.getMonthlyFreezeCount(),
    staleTime: 1000 * 60 * 5,
    retry: false,
  });
}

// ─── Mutations ──────────────────────────────────────────────────────────────────
// Skip/pause touch streaks, Today, and the heatmap, so we invalidate the whole
// habits tree (the data is small) rather than surgically.

export function useSkipDay() {
  const qc = useQueryClient();
  const isDemo = useIsDemo();
  return useMutation({
    mutationFn: ({ habitId, date, reason }: { habitId: string; date: string; reason?: string }) => {
      if (isDemo) throw new DemoReadOnlyError();
      return HabitService.addSkip(habitId, date, reason);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: HABIT_KEYS.all }),
    onError: (error) => { if (handledDemoError(error)) return; toast.error("Failed to skip this day."); },
  });
}

export function useUnskipDay() {
  const qc = useQueryClient();
  const isDemo = useIsDemo();
  return useMutation({
    mutationFn: ({ habitId, date }: { habitId: string; date: string }) => {
      if (isDemo) throw new DemoReadOnlyError();
      return HabitService.removeSkip(habitId, date);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: HABIT_KEYS.all }),
    onError: (error) => { if (handledDemoError(error)) return; toast.error("Failed to undo skip."); },
  });
}

export function useAddPause() {
  const qc = useQueryClient();
  const isDemo = useIsDemo();
  return useMutation({
    mutationFn: ({
      habitId,
      start,
      end,
    }: {
      habitId: string;
      start: string;
      end: string | null;
    }) => {
      if (isDemo) throw new DemoReadOnlyError();
      return HabitService.addPause(habitId, start, end);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: HABIT_KEYS.all }),
    onError: (error) => { if (handledDemoError(error)) return; toast.error("Failed to pause this habit."); },
  });
}

export function useRemovePause() {
  const qc = useQueryClient();
  const isDemo = useIsDemo();
  return useMutation({
    mutationFn: (pauseId: string) => {
      if (isDemo) throw new DemoReadOnlyError();
      return HabitService.removePause(pauseId);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: HABIT_KEYS.all }),
    onError: (error) => { if (handledDemoError(error)) return; toast.error("Failed to resume this habit."); },
  });
}

export function useFreezeDay() {
  const qc = useQueryClient();
  const isDemo = useIsDemo();
  return useMutation({
    mutationFn: ({ habitId, date }: { habitId: string; date: string }) => {
      if (isDemo) throw new DemoReadOnlyError();
      return HabitService.addFreeze(habitId, date);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: HABIT_KEYS.all }),
    onError: (error) => { if (handledDemoError(error)) return; toast.error("Failed to apply freeze."); },
  });
}

export function useUnfreezeDay() {
  const qc = useQueryClient();
  const isDemo = useIsDemo();
  return useMutation({
    mutationFn: ({ habitId, date }: { habitId: string; date: string }) => {
      if (isDemo) throw new DemoReadOnlyError();
      return HabitService.removeFreeze(habitId, date);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: HABIT_KEYS.all }),
    onError: (error) => { if (handledDemoError(error)) return; toast.error("Failed to remove freeze."); },
  });
}
